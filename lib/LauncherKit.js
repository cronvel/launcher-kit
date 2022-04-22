/*
	Launcher Kit

	Copyright (c) 2022 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const utils = require( './utils.js' ) ;
const camel = require( './camel.js' ) ;
const AppLauncher = require( './AppLauncher.js' ) ;

const kungFig = require( 'kung-fig' ) ;
const string = require( 'string-kit' ) ;
const path = require( 'path' ) ;
const Promise = require( 'seventh' ) ;

const fsPromise = require( 'fs' ).promises ;
const fsKit = require( 'fs-kit' ) ;

const tree = require( 'tree-kit' ) ;
const deepExtend = tree.extend.bind( { deep: true } ) ;

const os = require( 'os' ) ;
const osGeneric = require( './platforms/generic.js' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher' ) ;



function LauncherKit( params = {} ) {
	this.launcherAppName = params.launcherAppName ?? 'LauncherKit' ;

	this.appLaunchers = {} ;
	this.guiConfig = {} ;
	this.typesConfig = {} ;

	this.isConfigLoaded = false ;
	this.configPath = null ;

	this.isAppConfigDirLoaded = false ;
	this.appConfigDir = null ;

	this.isContentConfigDirLoaded = false ;
	this.contentConfigDir = null ;

	this.platform = process.platform ;

	// OS-specific things
	this.osSpecific = null ;

	try {
		this.osSpecific = require( './platforms/' + this.platform + '.js' ) ;
	}
	catch ( error ) {}

	this.osSpecific = deepExtend( {} , osGeneric , this.osSpecific ) ; 


	this.homeDir = os.homedir() ;
	this.homeConfigDir = path.join( this.homeDir , '.local' , 'share' , this.launcherAppName ) ;
	log.verbose( "%s home directory: %s" , this.launcherAppName , this.homeConfigDir ) ;
}

module.exports = LauncherKit ;



LauncherKit.prototype.loadHomeConfig = async function() {
	await fsKit.ensurePath( this.homeConfigDir ) ;
	this.configPath = path.join( this.homeConfigDir , 'config.kfg' ) ;

	if ( ! await fsKit.isFile( this.configPath ) ) {
		await fsKit.copy( path.join( __dirname , 'defaultConfig.kfg' ) , this.configPath ) ;
	}

	await this.loadConfig( this.configPath ) ;

	this.appConfigDir = path.join( this.homeConfigDir , 'apps' ) ;
	await fsKit.ensurePath( this.appConfigDir ) ;
	await this.loadAppConfigDir( this.appConfigDir ) ;

	this.contentConfigDir = path.join( this.homeConfigDir , 'contents' ) ;
	await fsKit.ensurePath( this.contentConfigDir ) ;
	await this.loadContentConfigDir( this.contentConfigDir ) ;
} ;



LauncherKit.prototype.loadConfig = async function( configPath ) {
	if ( this.isConfigLoaded ) {
		throw new Error( "Config already loaded!" ) ;
	}

	var config , userConfig , defaultOsConfig ,
		defaultConfig = require( './platforms/config.generic.js' ) ;

	try {
		defaultOsConfig = require( './platforms/config.' + this.platform + '.js' ) ;
	}
	catch ( error ) {
		defaultOsConfig = {} ;
	}

	this.configPath = configPath ;
	
	userConfig = await kungFig.loadAsync( configPath ) ;
	config = deepExtend( {} , defaultConfig , defaultOsConfig , userConfig ) ;
	camel.inPlaceDashToCamelProps( config ) ;

	if ( Array.isArray( config.apps ) ) {
		for ( let appConfig of config.apps ) {
			this.addApp( appConfig ) ;
		}
	}

	if ( config.gui && typeof config.gui === 'object' ) {
		// Userland GUI config
		Object.assign( this.guiConfig , config.gui ) ;
	}
	
	if ( config?.system?.types && typeof config.system.types === 'object' ) {
		Object.assign( this.typesConfig , config.system.types ) ;
	}
	
	this.isConfigLoaded = true ;
	log.verbose( "Main config loaded: %s" , configPath ) ;
} ;



LauncherKit.prototype.loadAppConfigDir = async function( appConfigDir ) {
	if ( this.isAppConfigDirLoaded ) {
		throw new Error( "App config directory already loaded!" ) ;
	}

	if ( ! await fsKit.isDir( appConfigDir ) ) {
		throw new Error( "App config directory not found: " + appConfigDir ) ;
	}

	this.appConfigDir = appConfigDir ;
	var filePathList = await fsKit.readdir( appConfigDir , { files: true , directories: false , exe: false } ) ;
	filePathList = filePathList
		.filter( fileName => fileName.endsWith( '.kfg' ) )
		.map( fileName => path.join( appConfigDir , fileName ) ) ;

	for ( let filePath of filePathList ) {
		await this.loadAppConfig( filePath ) ;
	}

	this.isAppConfigDirLoaded = true ;
	log.verbose( "App config directory loaded: %s" , appConfigDir ) ;
} ;



// For instance, it's the same than .loadAppConfig().
// Maybe later it would be able to load non-KFG file using defaults options for each extensions?
LauncherKit.prototype.loadContentConfigDir = async function( contentConfigDir ) {
	if ( this.isContentConfigDirLoaded ) {
		throw new Error( "Content config directory already loaded!" ) ;
	}

	if ( ! await fsKit.isDir( contentConfigDir ) ) {
		throw new Error( "Content config directory not found: " + contentConfigDir ) ;
	}

	this.contentConfigDir = contentConfigDir ;
	var filePathList = await fsKit.readdir( contentConfigDir , { files: true , directories: false , exe: false } ) ;
	filePathList = filePathList
		.filter( fileName => fileName.endsWith( '.kfg' ) )
		.map( fileName => path.join( contentConfigDir , fileName ) ) ;

	for ( let filePath of filePathList ) {
		await this.loadAppConfig( filePath ) ;
	}

	this.isContentConfigDirLoaded = true ;
	log.verbose( "Content config directory loaded: %s" , contentConfigDir ) ;
} ;



LauncherKit.prototype.loadAppConfig = async function( appConfigPath ) {
	var appConfig = await kungFig.loadAsync( appConfigPath ) ;
	camel.inPlaceDashToCamelProps( appConfig ) ;

	var typeConfig = this.typesConfig[ appConfig.type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	this.addApp( appConfig , appConfigPath ) ;
	log.verbose( "App config loaded: %s" , appConfigPath ) ;
} ;



LauncherKit.prototype.addAppByFile = async function( filePath , options ) {
	var id , name , type , typeConfig , appConfig , appConfigPath , Launcher , appLauncher ,
		extension = path.extname( filePath ) ,
		basename = path.basename( filePath , extension ) ;
	
	extension = extension.slice( 1 ) ;
	
	type = this.osSpecific.typePerExtension[ extension ] ;
	if ( ! type ) {
		if ( this.platform === 'linux' && await fsKit.isExe( filePath ) ) {
			type = 'native' ;
		}
		else {
			return null ;
		}
	}
	
	name = string.toTitleCase( basename , { dashToSpace: true } ) ;
	id = utils.nameToId( name ) ;

	appConfig = {
		id , name , type ,
		exe: filePath ,
		icon: await this.osSpecific.findIconFromFilePath( filePath )
	} ;
	
	typeConfig = this.typesConfig[ type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;
	appConfigPath = path.join( Launcher.prototype.isContent ? this.contentConfigDir : this.appConfigDir , id + '.kfg' ) ;
	
	log.hdebug( "New app config: %n" , appConfig ) ; 
	log.hdebug( "New app config path: %s" , appConfigPath ) ; 

	appLauncher = this.addApp( appConfig , appConfigPath ) ;
	await appLauncher.saveConfig() ;
	log.verbose( "App config added and saved: %s" , appConfigPath ) ;
} ;



LauncherKit.prototype.removeAppAndConfig = async function( appLauncher ) {
	var id = appLauncher.id ;
	if ( this.appLaunchers[ id ] !== appLauncher ) { return false ; }
	
	delete this.appLaunchers[ id ] ;
	
	try {
		if ( appLauncher.appConfigPath ) {
			await fsPromise.unlink( appLauncher.appConfigPath ) ;
		}
	}
	catch ( error ) {}

	return true ;
} ;



LauncherKit.prototype.getLauncherClass = function( type , use ) {
	var dir , launcherPath , Launcher ;

	dir = utils.strToPath( type ) ;
	if ( use ) { dir += '@' + utils.strToPath( use ) ; }
	launcherPath = './' + path.join( 'launchers' , dir , 'Launcher.js' ) ;

	try {
		Launcher = require( launcherPath ) ;
		log.verbose( "Launcher path: %s" , launcherPath ) ;
	}
	catch ( error ) {
		if ( error.code === 'MODULE_NOT_FOUND' ) {
			Launcher = AppLauncher ;
			log.verbose( "Using default launcher" ) ;
		}
		else {
			log.error( "Launcher '%s' error: %E" , launcherPath , error ) ;
			throw error ;
		}
	}
	
	return Launcher ;
} ;



LauncherKit.prototype.addApp = function( options , appConfigPath ) {
	var dir , launcherPath , Launcher , appLauncher ;

	if ( ! options.type ) { options.type = 'native' ; }
	
	Launcher = this.getLauncherClass( options.type , options.use ) ;

	appLauncher = new Launcher( this , options , appConfigPath ) ;
	this.appLaunchers[ appLauncher.id ] = appLauncher ;

	return appLauncher ;
} ;



LauncherKit.prototype.removeApp = function( appLauncher ) {
	var id = appLauncher.id ;
	if ( this.appLaunchers[ id ] !== appLauncher ) { return false ; }
	delete this.appLaunchers[ id ] ;
	return true ;
} ;



LauncherKit.prototype.getAppLauncherList = function( filterFn = null ) {
	var list = Object.values( this.appLaunchers ) ;

	if ( typeof filterFn === 'function' ) { list = list.filter( filterFn ) ; }
	
	list.sort( ( a , b ) => {
		if ( a.rank !== b.rank ) { return a.rank - b.rank ; }
		return string.naturalSort( a.id , b.id ) ;
	} ) ;
	
	return list ;
} ;



LauncherKit.prototype.launch = async function( id ) {
	var appLauncher = this.appLaunchers[ id ] ;
	if ( ! appLauncher ) { throw new Error( "App not found: " + id ) ; }
	await appLauncher.launch() ;
} ;

