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
const Meta = require( './Meta.js' ) ;
const AppMeta = require( './AppMeta.js' ) ;
const AppLauncher = require( './AppLauncher.js' ) ;
const ContentLauncher = require( './ContentLauncher.js' ) ;

const kungFig = require( 'kung-fig' ) ;
const string = require( 'string-kit' ) ;
const path = require( 'path' ) ;
const Promise = require( 'seventh' ) ;

const fsPromise = require( 'fs' ).promises ;
const fsKit = require( 'fs-kit' ) ;

const tree = require( 'tree-kit' ) ;
const deepExtend = tree.extend.bind( null , { deep: true } ) ;

const os = require( 'os' ) ;
const osGeneric = require( './platforms/generic.js' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function LauncherKit( params = {} ) {
	this.startupTime = new Date() ;
	this.launcherAppName = params.launcherAppName ?? 'LauncherKit' ;

	this.appLaunchers = {} ;
	this.guiConfig = {} ;
	this.typesConfig = {} ;

	this.isConfigLoaded = false ;
	this.configPath = null ;

	this.isMetaLoaded = false ;
	this.metaPath = null ;
	this.meta = null ;

	this.isAppConfigDirLoaded = false ;
	this.appConfigDir = null ;

	this.isContentConfigDirLoaded = false ;
	this.contentConfigDir = null ;

	this.platform = process.platform ;

	// OS-specific things
	this.osSpecific = LauncherKit.getOsSpecific( this.platform ) ;

	this.homeDir = os.homedir() ;
	this.homeConfigDir = this.osSpecific.getAppDataDir( this.launcherAppName ) ;
	this.configPath = path.join( this.homeConfigDir , 'config.kfg' ) ;
	this.metaPath = path.join( this.homeConfigDir , 'meta.kfg' ) ;
	this.appConfigDir = path.join( this.homeConfigDir , 'apps' ) ;
	this.contentConfigDir = path.join( this.homeConfigDir , 'contents' ) ;
	this.iconDir = path.join( this.homeConfigDir , 'icons' ) ;
	this.coverDir = path.join( this.homeConfigDir , 'covers' ) ;
	this.bannerDir = path.join( this.homeConfigDir , 'banners' ) ;
	this.logDir = path.join( this.homeConfigDir , 'log' ) ;
	this.lnkDir = path.join( this.homeConfigDir , 'lnk' ) ;
	this.cacheDir = path.join( this.homeConfigDir , 'cache' ) ;

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



LauncherKit.getOsSpecific = function( platform = process.platform ) {
	var osSpecific = deepExtend( {} , osGeneric ) ;

	try {
		let platformJs = require( './platforms/' + platform + '.js' ) ;
		deepExtend( osSpecific , platformJs ) ;
	}
	catch ( error ) {}

	return osSpecific ;
} ;



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
	await fsKit.ensurePath( this.logDir ) ;
	await fsKit.ensurePath( this.lnkDir ) ;
	await fsKit.ensurePath( this.cacheDir ) ;
} ;



LauncherKit.prototype.shutdown = async function() {
	if ( this.meta ) {
		this.meta.lastStartupTime = this.startupTime ;
		this.meta.lastShutdownTime = new Date() ;
		await this.saveMeta() ;
	}
} ;



LauncherKit.prototype.setTypesConfig = function( types ) {
	if ( ! types || typeof types !== 'object' ) { return ; }
	Object.assign( this.typesConfig , types ) ;
} ;



// update: if true, update the config after loading it, if necessary (when the lib change, new config entries are added)
LauncherKit.prototype.loadHomeConfig = async function( update = false ) {
	await this.loadConfig( this.configPath ) ;
	await this.loadMeta( this.metaPath ) ;
	await this.loadAppConfigDir( this.appConfigDir , update ) ;
	await this.loadContentConfigDir( this.contentConfigDir , update ) ;
} ;



LauncherKit.prototype.loadConfig = async function( configPath = this.configPath ) {
	if ( this.isConfigLoaded ) { throw new Error( "Config already loaded!" ) ; }

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



LauncherKit.prototype.loadMeta = async function( metaPath = this.metaPath ) {
	if ( this.isMetaLoaded ) { throw new Error( "Meta already loaded!" ) ; }

	this.metaPath = metaPath ;

	try {
		this.meta = await Meta.load( metaPath ) ;
	}
	catch ( error ) {
		log.error( "Loading Meta error: %E" , error ) ;
		this.meta = new Meta() ;
	}

	this.isMetaLoaded = true ;
	log.verbose( "Meta loaded: %s" , metaPath ) ;
} ;



LauncherKit.prototype.saveMeta = async function( metaPath = this.metaPath ) {
	if ( ! this.meta ) { throw new Error( "No Meta was loaded to be saved!" ) ; }

	try {
		await this.meta.save( metaPath ) ;
	}
	catch ( error ) {
		log.error( "Saving Meta error: %E" , error ) ;
		throw error ;
	}

	log.verbose( "Meta saved: %s" , metaPath ) ;
} ;



LauncherKit.prototype.loadAppConfigDir = async function( appConfigDir , update = false ) {
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
		await this.loadAppConfig( filePath , update ) ;
	}

	this.isAppConfigDirLoaded = true ;
	log.verbose( "App config directory loaded: %s" , appConfigDir ) ;
} ;



// For instance, it's the same than .loadAppConfig().
// Maybe later it would be able to load non-KFG file using defaults options for each extensions?
LauncherKit.prototype.loadContentConfigDir = async function( contentConfigDir , update = false ) {
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
		await this.loadAppConfig( filePath , update ) ;
	}

	this.isContentConfigDirLoaded = true ;
	log.verbose( "Content config directory loaded: %s" , contentConfigDir ) ;
} ;



LauncherKit.prototype.loadAppConfig = async function( appConfigPath , update = false ) {
	var appConfig = await kungFig.loadAsync( appConfigPath ) ;
	camel.inPlaceDashToCamelProps( appConfig ) ;

	var appLauncher = this.addApp( appConfig , appConfigPath ) ;
	log.verbose( "App config loaded: %s" , appConfigPath ) ;

	if ( update ) {
		let saved = await appLauncher.saveConfigIfChanged() ;
		if ( saved ) { log.verbose( "App config changed and saved: %s" , appConfigPath ) ; }
	}
} ;



LauncherKit.prototype.removeAppAndConfig = async function( appLauncher ) {
	var id = appLauncher.id ;
	if ( this.appLaunchers[ id ] !== appLauncher ) { return false ; }

	delete this.appLaunchers[ id ] ;

	if ( appLauncher.appConfigPath ) {
		try {
			await fsPromise.unlink( appLauncher.appConfigPath ) ;
		}
		catch ( error ) {}
	}

	if ( this.meta ) {
		delete this.meta.appMeta[ appLauncher.id ] ;
	}

	return true ;
} ;



LauncherKit.prototype.removeApp = function( appLauncher ) {
	var id = appLauncher.id ;
	if ( this.appLaunchers[ id ] !== appLauncher ) { return false ; }
	delete this.appLaunchers[ id ] ;

	if ( this.meta ) {
		delete this.meta.appMeta[ appLauncher.id ] ;
	}

	return true ;
} ;



LauncherKit.prototype.addApp = function( appConfig , appConfigPath ) {
	var dir , launcherPath , Launcher , appLauncher ;

	if ( ! appConfig.type ) {
		appConfig.type = appConfig.use === 'open' ? 'content' : 'native' ;
	}

	var typeConfig = this.typesConfig[ appConfig.type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;

	appLauncher = new Launcher( this , appConfig , appConfigPath ) ;

	if ( this.appLaunchers[ appLauncher.id ] ) {
		// What should be done here? For instance we just warn
		log.warning( "ID '%s' already exists! Replcaing it..." ) ;
	}

	this.appLaunchers[ appLauncher.id ] = appLauncher ;

	// Set meta for the appLauncher, if any...
	if ( this.meta ) {
		if ( this.meta.appMeta[ appLauncher.id ] ) {
			//log.hdebug( "Setting AppMeta for %s..." , appLauncher.id ) ;
			appLauncher.setMeta( this.meta.appMeta[ appLauncher.id ] ) ;
		}
		else {
			//log.hdebug( "Creating AppMeta for %s..." , appLauncher.id ) ;
			this.meta.appMeta[ appLauncher.id ] = new AppMeta() ;
			appLauncher.setMeta( this.meta.appMeta[ appLauncher.id ] ) ;
		}
	}

	return appLauncher ;
} ;



/*
	Argument options can be used for opening Windows .lnk, for instance the lib does not provide .lnk support.
	But Electron does support .lnk, could contains information extracted by Electron's the shell.readShortcutLink().

	* options `object` where:
		* directory `string` the working directory
		* args `array` of `string` the executable arguments list
		* icon `string` the icon filePath
		DEPRECATED:
		* basename `string` overide the basename (use-case: .lnk that have been parsed upstream, passing the .lnk basename instead of the target .exe basename)
*/
LauncherKit.prototype.addAppByFile = async function( filePath , options = {} ) {
	var id , name , type , typeConfig , appConfig , appConfigPath , Launcher , appLauncher , extractIconPath , iconPath ,
		autoUpdateIconPath = null ,
		useOpen = false ,
		extension = path.extname( filePath ) ,
		basename = options.basename || path.basename( filePath , extension ) ;

	if ( ! await fsKit.isFile( filePath ) ) {
		log.error( "App file not found: %s" , filePath ) ;
		return false ;
	}

	extension = extension.slice( 1 ).toLowerCase() ;

	if ( extension ) {
		type = this.osSpecific.typePerExtension[ extension ] ;

		if ( ! type ) {
			type = 'content' ;
			useOpen = true ;
		}
	}
	else {
		if ( await fsKit.isExe( filePath ) ) {
			type = 'native' ;
		}
		else {
			log.error( "Unknown file type (no extension, not executable): %s" , filePath ) ;
			return false ;
		}
	}

	name = string.toTitleCase( basename , { dashToSpace: true } ) ;
	id = utils.nameToId( name ) ;

	extractIconPath = path.join( this.iconDir , id + '.png' ) ;

	if ( options.icon ) {
		let iconExtension = path.extname( options.icon ).slice( 1 ).toLowerCase() ;

		if (
			( iconExtension === 'exe' || iconExtension === 'dll' || iconExtension === 'lnk' )
			&& await this.osSpecific.extractIcon( filePath , extractIconPath , 0 , 256 )
		) {
			iconPath = extractIconPath ;
			autoUpdateIconPath = filePath ;
		}
		else {
			iconPath = options.icon ;
		}
	}
	else if ( await this.osSpecific.extractIcon( filePath , extractIconPath , 0 , 256 ) ) {
		iconPath = extractIconPath ;
		autoUpdateIconPath = filePath ;
	}
	else {
		iconPath = await this.osSpecific.findIconFromFilePath( filePath ) ;
	}

	appConfig = {
		id ,
		name ,
		type ,
		icon: iconPath ,
		autoUpdateIconPath
	} ;

	if ( useOpen ) { appConfig.use = 'open' ; }

	typeConfig = this.typesConfig[ type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;

	appConfig[ Launcher.prototype.mainFileProperty ] = filePath ;
	appConfigPath = path.join( Launcher.prototype.isContent ? this.contentConfigDir : this.appConfigDir , id + '.kfg' ) ;

	if ( options.directory ) { appConfig.directory = options.directory ; }
	if ( Array.isArray( options.args ) ) { appConfig.args = options.args ; }

	log.verbose( "New app config: %n" , appConfig ) ;
	log.verbose( "New app config path: %s" , appConfigPath ) ;

	appLauncher = this.addApp( appConfig , appConfigPath ) ;
	await appLauncher.saveConfig() ;
	log.verbose( "App config added and saved: %s" , appConfigPath ) ;

	return true ;
} ;



/*
	Add an app using data retrieved by .getInstalledAppList().
*/
LauncherKit.prototype.addAppByPreConfig = async function( appConfig ) {
	var typeConfig , appConfigPath , Launcher , appLauncher ;

	if ( ! appConfig.id ) { appConfig.id = utils.nameToId( appConfig.name ) ; }

	// Icon extraction is already done here?
	// We just have to copy the file in our directory.
	if ( appConfig.icon ) {
		let iconDir = path.dirname( appConfig.icon ) ;

		if ( iconDir !== this.iconDir ) {
			let iconBasename = path.basename( appConfig.icon ) ;
			let extractIconPath = path.join( this.iconDir , iconBasename ) ;
			await fsKit.copy( appConfig.icon , extractIconPath ) ;
			appConfig.icon = extractIconPath ;
		}
	}

	typeConfig = this.typesConfig[ appConfig.type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;

	appConfigPath = path.join( Launcher.prototype.isContent ? this.contentConfigDir : this.appConfigDir , appConfig.id + '.kfg' ) ;

	log.verbose( "New app config: %n" , appConfig ) ;
	log.verbose( "New app config path: %s" , appConfigPath ) ;

	appLauncher = this.addApp( appConfig , appConfigPath ) ;
	await appLauncher.saveConfig() ;
	log.verbose( "App config added and saved: %s" , appConfigPath ) ;

	return true ;
} ;



LauncherKit.prototype.getLauncherClass = function( type , use ) {
	var Launcher , dir , launcherPath ;

	if ( use === 'open' ) {
		// Special case
		Launcher = ContentLauncher ;
		log.verbose( "Using content launcher" ) ;
	}
	else {
		dir = utils.strToPath( type ) ;
		if ( use ) { dir += '@' + utils.strToPath( use ) ; }
		launcherPath = './' + path.join( 'launchers' , dir , 'Launcher.js' ) ;

		try {
			Launcher = require( launcherPath ) ;
			log.verbose( "Launcher path: %s" , launcherPath ) ;
		}
		catch ( error ) {
			if ( error.code === 'MODULE_NOT_FOUND' ) {
				Launcher = ContentLauncher ;
				log.verbose( "Using content launcher instead of missing launcher: %s" , launcherPath ) ;
			}
			else {
				log.error( "Launcher '%s' error: %E" , launcherPath , error ) ;
				throw error ;
			}
		}
	}

	return Launcher ;
} ;



const FILTERED_PROPERTIES = [ 'name' , 'title' , 'baseline' , 'description' ] ;

LauncherKit.prototype.getAppLauncherList = function( filterFn = null , filterStr = null , filterProperties = FILTERED_PROPERTIES ) {
	var appList = Object.values( this.appLaunchers ) ;

	// First, apply filterFn if any
	if ( typeof filterFn === 'function' ) { appList = appList.filter( filterFn ) ; }


	// Then apply a filter string, if any
	var appScore = null ;
	filterStr = filterStr ? filterStr.trim() : null ;

	if ( filterStr ) {
		appScore = {} ;
		let filters = filterStr.split( / +/g ).map( part => part.toLowerCase().trim() ) ;

		appList = appList.filter( app => {
			let score = 0 ,
				validFilterCount = 0 ;

			for ( let filter of filters ) {
				let isExclusive = false ,
					isPositive = true ,
					filterContent = filter ;

				if ( filterContent[ 0 ] === '+' ) { isExclusive = true ; filterContent = filterContent.slice( 1 ) ; }
				if ( filterContent[ 0 ] === '-' ) { isExclusive = true ; isPositive = false ; filterContent = filterContent.slice( 1 ) ; }

				if ( ! filterContent ) { continue ; }

				let filterMatch = ! isPositive ;
				validFilterCount ++ ;

				for ( let property of filterProperties ) {
					if ( app[ property ] ) {
						let has = app[ property ].toLowerCase().includes( filterContent ) ;

						if ( isPositive ) {
							if ( has ) { filterMatch = true ; break ; }
						}
						else {
							if ( has ) { filterMatch = false ; break ; }
						}
					}
				}

				if ( filterMatch ) {
					score ++ ;
				}
				else if ( isExclusive ) {
					return false ;
				}
			}

			if ( ! validFilterCount ) {
				appScore[ app.id ] = 0 ;
				return true ;
			}

			if ( ! score ) {
				return false ;
			}

			appScore[ app.id ] = score / validFilterCount ;
			return true ;
		} ) ;
	}


	// Finally, sort result by rank or natural sort
	appList.sort( ( a , b ) => {
		//log.hdebug( "sort %s (S=%f) vs %s (S=%f)" , a.id , appScore?.[ a.id ] , b.id , appScore?.[ b.id ] ) ;
		if ( appScore && appScore[ a.id ] !== appScore[ b.id ] ) { return appScore[ b.id ] - appScore[ a.id ] ; }
		if ( a.rank !== b.rank ) { return a.rank - b.rank ; }
		return string.naturalSort( a.id , b.id ) ;
	} ) ;

	return appList ;
} ;



/*
	Options:
		fromCache: return cached data instead of doing the search
		noCache: don't save the list in the cache
*/
LauncherKit.prototype.getInstalledAppList = async function( options = {} ) {
	var list ,
		listFilePath = path.join( this.cacheDir , 'installedAppList.json' ) ;

	if ( options.fromCache ) {
		let content = null ;

		try {
			content = await fsPromise.readFile( listFilePath , 'utf8' ) ;
		}
		catch ( error ) {
			log.verbose( "No cache found for: %s" , listFilePath ) ;
			return null ;
		}

		try {
			list = JSON.parse( content ) ;
		}
		catch ( error ) {
			log.verbose( "File corrupted: %s" , listFilePath ) ;

			try {
				await fsPromise.unlink( listFilePath ) ;
			}
			catch ( error_ ) {}

			return null ;
		}

		return list ;
	}

	list = await this.osSpecific.getInstalledAppList( this.cacheDir ) ;

	if ( ! options.noCache ) {
		await fsPromise.writeFile( listFilePath , JSON.stringify( list ) ) ;
	}

	return list ;
} ;



LauncherKit.prototype.launch = async function( id ) {
	var appLauncher = this.appLaunchers[ id ] ;
	if ( ! appLauncher ) { throw new Error( "App not found: " + id ) ; }
	await appLauncher.launch() ;
} ;



LauncherKit.prototype.reindex = function( filterFn = null ) {
	this.getAppLauncherList( filterFn ).forEach( ( app , index ) => app.rank = index ) ;
} ;



LauncherKit.prototype.reindexAndSave = function( filterFn = null ) {
	var saveList = [] ;

	this.getAppLauncherList( filterFn ).forEach( ( app , index ) => {
		if ( app.rank !== index ) {
			app.rank = index ;
			saveList.push( app ) ;
		}
	} ) ;

	if ( ! saveList.length ) { return Promise.resolved ; }

	return Promise.every( saveList , app => app.saveConfig() ) ;
} ;



const DEFAULT_AUTO_UPDATE_ICON_TIMEOUT = 24 * 60 * 60 * 1000 ;	// 1 day

LauncherKit.prototype.autoUpdateIcon = async function( timeout = DEFAULT_AUTO_UPDATE_ICON_TIMEOUT ) {
	var now = Date.now() ;

	for ( let id in this.appLaunchers ) {
		let needUpdate , iconSourcePath ;
		let appLauncher = this.appLaunchers[ id ] ;

		if ( this.osSpecific.extractIcon.unsupported ) {
			needUpdate = false ;
		}
		else if ( appLauncher.autoUpdateIconPath && appLauncher.meta && ( ! appLauncher.meta.lastIconUpdateTime || now - appLauncher.meta.lastIconUpdateTime >= timeout ) ) {
			// App having icon auto-update
			needUpdate = true ;
			iconSourcePath = appLauncher.autoUpdateIconPath ;
			log.verbose( ".autoUpdateIcon(): Icon may need to be refreshed for ID '%s' (last update: %s)" ,
				appLauncher.id ,
				appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
			) ;
		}
		else if ( ! appLauncher.icon && appLauncher.exe ) {
			// No icon configured, but with an exe
			needUpdate = true ;
			iconSourcePath = appLauncher.exe ;
			log.warning( ".autoUpdateIcon(): No icon configured for ID '%s'" , appLauncher.id ) ;
		}
		else if ( appLauncher.icon && appLauncher.exe && ! await fsKit.isFile( appLauncher.icon ) ) {
			// App without an icon but with an exe
			needUpdate = true ;
			iconSourcePath = appLauncher.exe ;
			log.warning( ".autoUpdateIcon(): Icon is gone for ID '%s': %s" , appLauncher.id , appLauncher.icon ) ;
		}
		else {
			needUpdate = false ;
		}

		if ( ! needUpdate ) { continue ; }

		let iconSourceExtension = path.extname( iconSourcePath ).slice( 1 ).toLowerCase() ;

		if ( iconSourceExtension !== 'exe' && iconSourceExtension !== 'dll' ) { continue ; }

		let extractIconPath = appLauncher.icon || path.join( this.iconDir , appLauncher.id + '.png' ) ;

		log.verbose( ".autoUpdateIcon(): About to extract icon for ID '%s', source: %s, dest: %s (last update: %s)" ,
			appLauncher.id , iconSourcePath , extractIconPath ,
			appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
		) ;

		if ( await this.osSpecific.extractIcon( iconSourcePath , extractIconPath , 0 , 256 ) ) {
			if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }
			appLauncher.icon = extractIconPath ;
			await appLauncher.saveConfigIfChanged() ;
			log.verbose( ".autoUpdateIcon(): Icon extraction successful for ID '%s' (new update time: %s)" ,
				appLauncher.id ,
				appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
			) ;
		}
		else {
			// /!\ For instance, we will set the update timestamp nonetheless
			if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }
			log.error( ".autoUpdateIcon(): Icon extraction FAILED for ID '%s' (new update time: %s)" ,
				appLauncher.id ,
				appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
			) ;
		}
	}
} ;

