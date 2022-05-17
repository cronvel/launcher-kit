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
	this.homeConfigDir = this.osSpecific.getAppDataDir( this.launcherAppName ) ;
	this.configPath = path.join( this.homeConfigDir , 'config.kfg' ) ;
	this.appConfigDir = path.join( this.homeConfigDir , 'apps' ) ;
	this.contentConfigDir = path.join( this.homeConfigDir , 'contents' ) ;
	this.iconDir = path.join( this.homeConfigDir , 'icons' ) ;
	this.coverDir = path.join( this.homeConfigDir , 'covers' ) ;
	this.bannerDir = path.join( this.homeConfigDir , 'banners' ) ;

	this.defaultConfig = require( './platforms/config.generic.js' ) ;

	try {
		let defaultPlatformConfig = require( './platforms/config.' + this.platform + '.js' ) ;
		this.defaultConfig = deepExtend( {} , this.defaultConfig , defaultPlatformConfig ) ;
	}
	catch ( error ) {}

	if ( this.defaultConfig?.system?.types && typeof this.defaultConfig.system.types === 'object' ) {
		this.setTypesConfig( this.defaultConfig.system.types ) ;
	}

	log.verbose( "%s home config directory: %s" , this.launcherAppName , this.homeConfigDir ) ;
}

module.exports = LauncherKit ;



LauncherKit.prototype.initConfigDir = async function() {
	await fsKit.ensurePath( this.homeConfigDir ) ;

	if ( ! await fsKit.isFile( this.configPath ) ) {
		await fsKit.copy( path.join( __dirname , 'defaultConfig.kfg' ) , this.configPath ) ;
	}

	await fsKit.ensurePath( this.appConfigDir ) ;
	await fsKit.ensurePath( this.contentConfigDir ) ;
	await fsKit.ensurePath( this.iconDir ) ;
	await fsKit.ensurePath( this.coverDir ) ;
	await fsKit.ensurePath( this.bannerDir ) ;
} ;



LauncherKit.prototype.setTypesConfig = function( types ) {
	if ( ! types || typeof types !== 'object' ) { return ; }
	Object.assign( this.typesConfig , types ) ;
} ;



LauncherKit.prototype.loadHomeConfig = async function() {
	await this.loadConfig( this.configPath ) ;
	await this.loadAppConfigDir( this.appConfigDir ) ;
	await this.loadContentConfigDir( this.contentConfigDir ) ;
} ;



LauncherKit.prototype.loadConfig = async function( configPath ) {
	if ( this.isConfigLoaded ) {
		throw new Error( "Config already loaded!" ) ;
	}

	var config , userConfig ;

	this.configPath = configPath ;

	userConfig = await kungFig.loadAsync( configPath ) ;
	config = deepExtend( {} , this.defaultConfig , userConfig ) ;
	camel.inPlaceDashToCamelProps( config ) ;

	if ( config.gui && typeof config.gui === 'object' ) {
		// Userland GUI config
		Object.assign( this.guiConfig , config.gui ) ;
	}

	if ( config?.system?.types && typeof config.system.types === 'object' ) {
		this.setTypesConfig( config.system.types ) ;
	}

	if ( Array.isArray( config.apps ) ) {
		for ( let appConfig of config.apps ) {
			this.addApp( appConfig ) ;
		}
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

	this.addApp( appConfig , appConfigPath ) ;
	log.verbose( "App config loaded: %s" , appConfigPath ) ;
} ;



LauncherKit.prototype.addAppByFile = async function( filePath , options ) {
	var id , name , type , typeConfig , appConfig , appConfigPath , Launcher , appLauncher , extractIconPath , iconPath ,
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

	if ( ! await fsKit.isFile( filePath ) ) {
		log.error( "App file not found: %s" , filePath ) ;
		return ;
	}

	extractIconPath = path.join( this.iconDir , id + '.ico' ) ;

	if ( await this.osSpecific.extractIconFromExe( filePath , extractIconPath ) ) {
		iconPath = extractIconPath ;
	}
	else {
		iconPath = await this.osSpecific.findIconFromFilePath( filePath ) ;
	}

	appConfig = {
		id ,
		name ,
		type ,
		icon: iconPath ,
		exe: filePath
	} ;

	typeConfig = this.typesConfig[ type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;
	appConfigPath = path.join( Launcher.prototype.isContent ? this.contentConfigDir : this.appConfigDir , id + '.kfg' ) ;

	log.verbose( "New app config: %n" , appConfig ) ;
	log.verbose( "New app config path: %s" , appConfigPath ) ;

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



LauncherKit.prototype.addApp = function( appConfig , appConfigPath ) {
	var dir , launcherPath , Launcher , appLauncher ;

	if ( ! appConfig.type ) { appConfig.type = 'native' ; }

	var typeConfig = this.typesConfig[ appConfig.type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;

	appLauncher = new Launcher( this , appConfig , appConfigPath ) ;
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



LauncherKit.prototype.reindex = function( filterFn = null ) {
	this.getAppLauncherList( filterFn ).forEach( ( app , index ) => app.rank = index ) ;
} ;



LauncherKit.prototype.reindexAndSave = async function( filterFn = null ) {
	var list = this.getAppLauncherList( filterFn ) ;

	var index = 0 ;
	for ( let app of list ) {
		if ( app.rank !== index ) {
			app.rank = index ;
			await app.saveConfig() ;
		}
		index ++ ;
	}
} ;



LauncherKit.prototype.launch = async function( id ) {
	var appLauncher = this.appLaunchers[ id ] ;
	if ( ! appLauncher ) { throw new Error( "App not found: " + id ) ; }
	await appLauncher.launch() ;
} ;

