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
const doormen = require( 'doormen' ) ;

const os = require( 'os' ) ;
const osGeneric = require( './platforms/generic.js' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



//const DEFAULT_AUTO_UPDATE_ICON_TIMEOUT = 24 * 60 * 60 * 1000 ;  // 1 day
const DEFAULT_AUTO_UPDATE_ICON_TIMEOUT = 7 * 24 * 60 * 60 * 1000 ;  // 1 week



function LauncherKit( params = {} ) {
	this.startupTime = new Date() ;
	this.launcherAppName = params.launcherAppName || 'LauncherKit' ;
	this.launcherAppChannel = params.launcherAppChannel || 'release' ;

	this.appLaunchers = {} ;
	this.guiConfig = {} ;
	this.typesConfig = {} ;

	this.isConfigLoaded = false ;
	this.isAppConfigDirLoaded = false ;
	this.isContentConfigDirLoaded = false ;

	this.isMetaLoaded = false ;
	this.meta = null ;

	this.platform = process.platform ;

	// OS-specific things
	this.osSpecific = LauncherKit.getOsSpecific( this.platform ) ;

	this.homeDir = os.homedir() ;
	this.homeConfigDir = this.osSpecific.getAppDataDir( this.launcherAppName , this.launcherAppChannel ) ;
	this.configPath = path.join( this.homeConfigDir , 'config.kfg' ) ;
	this.metaPath = path.join( this.homeConfigDir , 'meta.kfg' ) ;
	this.appConfigDir = path.join( this.homeConfigDir , 'apps' ) ;
	this.contentConfigDir = path.join( this.homeConfigDir , 'contents' ) ;
	this.contentCopyDir = path.join( this.homeConfigDir , 'contents-copies' ) ;
	this.iconDir = path.join( this.homeConfigDir , 'icons' ) ;
	this.coverDir = path.join( this.homeConfigDir , 'covers' ) ;
	this.bannerDir = path.join( this.homeConfigDir , 'banners' ) ;
	this.logDir = path.join( this.homeConfigDir , 'log' ) ;
	this.linkDir = path.join( this.homeConfigDir , 'links' ) ;
	this.cacheDir = path.join( this.homeConfigDir , 'cache' ) ;

	this.autoUpdateIconTimeout = params.autoUpdateIconTimeout || DEFAULT_AUTO_UPDATE_ICON_TIMEOUT ;
	this.copyContent = !! params.copyContent ;

	this.defaultConfigPath = params.defaultConfigPath || path.join( __dirname , 'defaultConfig.kfg' ) ;
	this.platformConfig = require( './platforms/config.generic.js' ) ;

	try {
		let specificPlatformConfig = require( './platforms/config.' + this.platform + '.js' ) ;
		this.platformConfig = deepExtend( {} , this.platformConfig , specificPlatformConfig ) ;
	}
	catch ( error ) {
		if ( error.code !== 'MODULE_NOT_FOUND' ) {
			throw error ;
		}
	}

	if ( this.platformConfig?.system?.types && typeof this.platformConfig.system.types === 'object' ) {
		this.setTypesConfig( this.platformConfig.system.types ) ;
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
	catch ( error ) {
		if ( error.code !== 'MODULE_NOT_FOUND' ) {
			throw error ;
		}
	}

	return osSpecific ;
} ;



LauncherKit.prototype.initConfigDir = async function() {
	await fsKit.ensurePath( this.homeConfigDir ) ;
	await fsKit.ensurePath( this.appConfigDir ) ;
	await fsKit.ensurePath( this.contentConfigDir ) ;
	await fsKit.ensurePath( this.contentCopyDir ) ;
	await fsKit.ensurePath( this.iconDir ) ;
	await fsKit.ensurePath( this.coverDir ) ;
	await fsKit.ensurePath( this.bannerDir ) ;
	await fsKit.ensurePath( this.logDir ) ;
	await fsKit.ensurePath( this.linkDir ) ;
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
	await this.loadConfig( this.configPath , update ) ;
	await this.loadMeta( this.metaPath ) ;
	await this.loadAppConfigDir( this.appConfigDir , update ) ;
	await this.loadContentConfigDir( this.contentConfigDir , update ) ;
} ;



LauncherKit.prototype.loadConfig = async function( configPath = this.configPath , update = false ) {
	if ( this.isConfigLoaded ) { throw new Error( "Config already loaded!" ) ; }

	var config , userConfig ,
		changed = false ;

	this.configPath = configPath ;

	try {
		userConfig = await kungFig.loadAsync( configPath ) ;
		camel.inPlaceDashToCamelProps( userConfig ) ;
	}
	catch ( error ) {
		log.warning( "Can't load config: %s" , error ) ;
		changed = true ;
		userConfig = {} ;
	}

	if ( update && this.configPath && this.defaultConfigPath ) {
		try {
			let defaultConfig = await kungFig.loadAsync( this.defaultConfigPath ) ;
			let changedByDefault = utils.extendDefault( userConfig , defaultConfig , true ) ;
			changed = changed || changedByDefault ;
		}
		catch ( error ) {
			// Log error, but continue
			log.error( "Can't extend with default config: %E" , error ) ;
		}

		if ( changed ) {
			log.info( "The default config have new keys: extending and saving the user config with the new defaults keys" ) ;
			await kungFig.saveKfgAsync( userConfig , this.configPath , { preferYesNo: true } ) ;
		}
	}

	config = deepExtend( {} , this.platformConfig , userConfig ) ;

	if ( typeof config.autoUpdateIconTimeout === 'number' ) {
		this.autoUpdateIconTimeout = config.autoUpdateIconTimeout || 0 ;
	}
	else if ( config.autoUpdateIconTimeout && typeof config.autoUpdateIconTimeout === 'object' ) {
		this.autoUpdateIconTimeout = utils.timeoutObjectToNumber( config.autoUpdateIconTimeout ) ;
	}

	if ( config.copyContent !== undefined ) { this.copyContent = !! config.copyContent ; }

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
	log.verbose( "About to delete app %s" , id ) ;

	delete this.appLaunchers[ id ] ;

	// Maybe launchers could define more things to delete later, for instance it's common
	var deleteList = [
		appLauncher.appConfigPath ,
		appLauncher.icon , appLauncher.cover , appLauncher.banner ,
		appLauncher.getMainFile()
	] ;

	for ( let filePath of deleteList ) {
		// Delete the file if it's inside our directories
		if ( filePath && path.isAbsolute( filePath ) && filePath.startsWith( this.homeConfigDir ) ) {
			log.verbose( "Deleting file associated to %s: %s" , id , filePath ) ;
			try {
				await fsPromise.unlink( filePath ) ;
			}
			catch ( error ) {}
		}
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



// This is very low level, userland/GUI should use .addAppByFile() or .addAppByPreConfig()
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
		log.warning( "ID '%s' already exists! Replacing it..." , appLauncher.id ) ;
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



LauncherKit.prototype.addAppByBuffer = async function( buffer , fileName , appConfigOverride = null ) {
	var filePath = path.join( this.contentCopyDir , fileName ) ;
	await fsPromise.writeFile( filePath , buffer ) ;
	await this.addAppByFile( filePath , appConfigOverride ) ;
} ;



/*
	Try to create an app using only a file as a source, guessing its type and all
*/
LauncherKit.prototype.addAppByFile = async function( filePath , appConfigOverride = null ) {
	if ( ! await fsKit.isFile( filePath ) ) {
		log.error( "App file not found: %s" , filePath ) ;
		return false ;
	}

	var id , name , typeConfig , appConfig , appConfigPath , Launcher , appLauncher , extractIconPath , iconPath ,
		type = appConfigOverride?.type ,
		autoUpdateIconPath = null ,
		useOpen = !! appConfigOverride?.useOpen ,
		dirname = path.dirname( filePath ) ,
		extension = path.extname( filePath ) ,
		basename = path.basename( filePath , extension ) ;

	extension = extension.slice( 1 ).toLowerCase() ;

	name = appConfigOverride?.name ?? string.toTitleCase( basename , { dashToSpace: true } ) ;

	if ( this.osSpecific.isLink( filePath ) ) {
		//log.hdebug( "It's a link: %s" , filePath ) ;
		let linkData = await this.osSpecific.extractLink( filePath ) ;
		//log.hdebug( "It's a link ('%s'), extracted data: %Y" , filePath , linkData ) ;

		if ( ! linkData ) {
			// Something went wrong
			log.error( "Link extraction failed for: '%s'" , filePath ) ;
			return false ;
		}

		if ( linkData.isConfig ) {
			// We've got an app config!
			appConfig = linkData ;
			appConfig.name = name ;

			if ( appConfigOverride ) { deepExtend( appConfig , appConfigOverride ) ; }

			return this.addAppByPreConfig( appConfig ) ;
		}

		if ( linkData.targetPath ) {
			if ( this.osSpecific.isLink( linkData.targetPath )  ) {
				// It could lead to circular links
				log.error( "Link extraction failed for: '%s' (link to a link: '%s')" , filePath , linkData.targetPath ) ;
				return false ;
			}

			// So... try to add the link's target
			return this.addAppByFile( linkData.targetPath , appConfigOverride ) ;
		}

		// On Windows, it's probable that it's an appX link (they are not extractable ATM)
		let copyPath = path.join( this.linkDir , basename + '.' + extension ) ;
		log.verbose( "Link has no targetPath, the link will be THE content to open, save it to the link directory: '%s' -> '%s'" , filePath , copyPath ) ;
		await fsKit.copy( filePath , copyPath ) ;

		filePath = copyPath ;
		dirname = path.dirname( filePath ) ;
	}

	if ( ! type ) {
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
	}

	id = appConfigOverride?.id ?? utils.nameToId( name ) ;

	appConfig = {
		id ,
		name ,
		type ,
		directory: dirname
	} ;

	if ( useOpen ) { appConfig.use = 'open' ; }

	typeConfig = this.typesConfig[ type ] ;

	if ( appConfigOverride ) { deepExtend( appConfig , appConfigOverride ) ; }
	if ( typeConfig ) { appConfig = deepExtend( {} , typeConfig , appConfig ) ; }

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;

	if ( Launcher.prototype.mainFileProperty ) { appConfig[ Launcher.prototype.mainFileProperty ] = filePath ; }
	appConfigPath = path.join( Launcher.prototype.isContent ? this.contentConfigDir : this.appConfigDir , id + '.kfg' ) ;

	appLauncher = this.addApp( appConfig , appConfigPath ) ;

	// Extract the icon and update appLauncher accordingly
	await this.extractIcon( appLauncher ) ;

	// Should come after .extractIcon(), because it could be useful to have the exact source to find an icon.
	await this.copyMainFile( appLauncher ) ;

	log.verbose( "New app config: %n" , appLauncher.appConfig ) ;
	log.verbose( "New app config path: %s" , appConfigPath ) ;

	await appLauncher.saveConfig() ;
	log.verbose( "App config added and saved: %s" , appConfigPath ) ;

	return true ;
} ;



/*
	Add an app using data retrieved by .getInstalledAppList(), or by link extraction, or whatever...
	Here we should already have some pre-config.
*/
LauncherKit.prototype.addAppByPreConfig = async function( appConfig ) {
	var typeConfig , appConfigPath , Launcher , appLauncher ;

	if ( ! appConfig.id ) { appConfig.id = utils.nameToId( appConfig.name ) ; }

	typeConfig = this.typesConfig[ appConfig.type ] ;

	if ( typeConfig ) {
		appConfig = deepExtend( {} , typeConfig , appConfig ) ;
	}

	Launcher = this.getLauncherClass( appConfig.type , appConfig.use ) ;

	appConfigPath = path.join( Launcher.prototype.isContent ? this.contentConfigDir : this.appConfigDir , appConfig.id + '.kfg' ) ;

	appLauncher = this.addApp( appConfig , appConfigPath ) ;

	// Extract the icon and update appLauncher accordingly
	await this.extractIcon( appLauncher ) ;
	// Should come after .extractIcon(), because it could be useful to have the exact source to find an icon.
	await this.copyMainFile( appLauncher ) ;

	log.verbose( "New app config: %n" , appLauncher.appConfig ) ;
	log.verbose( "New app config path: %s" , appConfigPath ) ;

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



LauncherKit.prototype.getAppFinder = function( type ) {
	var getInstalledAppList ,
		dir = utils.strToPath( type ) ,
		osSpecificPath = './' + path.join( 'launchers' , dir , 'getInstalledAppList.' + process.platform + '.js' )  ,
		genericPath = './' + path.join( 'launchers' , dir , 'getInstalledAppList.js' ) ;

	try {
		getInstalledAppList = require( osSpecificPath ) ;
		log.verbose( "App finder path: %s" , osSpecificPath ) ;
	}
	catch ( error ) {
		if ( error.code === 'MODULE_NOT_FOUND' ) {
			try {
				getInstalledAppList = require( genericPath ) ;
				log.verbose( "App finder path: %s" , genericPath ) ;
			}
			catch ( error_ ) {
				if ( error_.code === 'MODULE_NOT_FOUND' ) {
					// It's not an error at all, there is simply no app finder for this type
					return null ;
				}

				log.error( "App finder '%s' error: %E" , genericPath , error_ ) ;
				throw error_ ;
			}
		}
		else {
			log.error( "App finder '%s' error: %E" , osSpecificPath , error ) ;
			throw error ;
		}
	}

	getInstalledAppList.type = type ;
	return getInstalledAppList ;
} ;



LauncherKit.prototype.getAllAppFinders = async function() {
	var escape = string.escape.regExp ,
		types = new Set() ,
		appFinders = [] ;

	var addAppFinders = ( filePaths , regExp ) => {
		for ( let filePath of filePaths ) {
			let match = filePath.match( regExp ) ;
			if ( ! match || types.has( match[ 1 ] ) ) { continue ; }

			let type = match[ 1 ] ;
			if ( types.has( type ) ) { continue ; }

			types.add( type ) ;

			try {
				appFinders.push( require( filePath ) ) ;
			}
			catch ( error ) {
				log.error( "Error loading app finder for type %s: %E" , type , error ) ;
			}
		}
	} ;

	addAppFinders(
		await fsKit.glob( __dirname + '/launchers/*/getInstalledAppList.' + process.platform + '.js' ) ,
		new RegExp( escape( __dirname + '/launchers/' ) + '([^/]+)' + escape( '/getInstalledAppList.' + process.platform + '.js' ) )
	) ;

	addAppFinders(
		await fsKit.glob( __dirname + '/launchers/*/getInstalledAppList.js' ) ,
		new RegExp( escape( __dirname + '/launchers/' ) + '([^/]+)' + escape( '/getInstalledAppList.js' ) )
	) ;

	// When a plugin system will exist, we will be adding more sources here...

	return appFinders ;
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


	// Use the cache?

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


	// Use some app finders to detect more apps?

	var appFinders = null ;

	if ( options.types === true || options.types === 'all'  ) {
		appFinders = await this.getAllAppFinders() ;
	}
	else if ( Array.isArray( options.types ) ) {
		appFinders = options.types.map( type => {
			try {
				return this.getAppFinder( type ) ;
			}
			catch ( error ) {
				log.error( "Can't load app finder '%s': %E" , type , error ) ;
				return null ;
			}
		} ).filter( item => item ) ;
	}

	if ( appFinders ) {
		for ( let getInstalledAppList of appFinders ) {
			try {
				await getInstalledAppList( this.cacheDir , list ) ;
			}
			catch ( error ) {
				log.error( "App finder '%s' error: %E" , getInstalledAppList.type , error ) ;
			}
		}
	}


	// Filtering and ordering

	// Deduplicate by name
	var nameList = new Set() ;
	list = list.filter( item => {
		if ( nameList.has( item.name ) ) { return false ; }
		nameList.add( item.name ) ;
		return true ;
	} ) ;

	// Sort the list
	list.sort( ( a , b ) => string.naturalSort( a.name , b.name ) ) ;


	// Write to the cache

	if ( ! options.noCache ) {
		await fsPromise.writeFile( listFilePath , JSON.stringify( list , undefined , "\t" ) ) ;
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



LauncherKit.prototype.copyMainFile = async function( appLauncher ) {
	var copyPath ,
		filePath = appLauncher.getMainFile() ;

	// Some App have no file, but instead an ID (e.g. AppX, SteamID, etc)
	if ( ! filePath ) { return ; }

	var extension = path.extname( filePath ) ;

	if ( ! appLauncher.isContent || ! this.copyContent || filePath.startsWith( this.contentCopyDir ) ) { return ; }

	copyPath = path.join( this.contentCopyDir , appLauncher.id + extension ) ;
	log.verbose( "Copying content from %s to %s" , filePath , copyPath ) ;
	await fsKit.copy( filePath , copyPath ) ;
	appLauncher.setMainFile( copyPath ) ;

	if ( appLauncher.directory === path.dirname( filePath ) ) {
		appLauncher.directory = path.dirname( copyPath ) ;
	}
} ;



// Note: .lnk does not contains icons, but they can be extracted using associated icons (works for AppX which have no link data)
const ICON_EXTRACTION_EXTENSIONS = new Set( [ 'exe' , 'dll' , 'lnk' ] ) ;
const ICON_IMAGE_EXTENSIONS = new Set( [ 'ico' , 'png' , 'jpg' , 'svg' , 'webp' ] ) ;

/*
	Extract/copy icon to our folder.
*/
LauncherKit.prototype.extractIcon = async function( appLauncher ) {
	var iconSourcePath , iconSourceIndex , extractIconPath ,
		extractIconPathNoExt = path.join( this.iconDir , appLauncher.id ) ;

	// It was already extracted from somewhere else! E.g. by .getInstalledAppList()
	if ( appLauncher.extractedIcon ) {
		// We should not have to check extension here, because it's likely our code that have created it
		let iconExtension = path.extname( appLauncher.extractedIcon ).slice( 1 ).toLowerCase() ;
		extractIconPath = extractIconPathNoExt + '.' + iconExtension ;

		await fsKit.copy( appLauncher.extractedIcon , extractIconPath ) ;

		if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }

		log.verbose( ".extractIcon(): Icon was already extracted, successfully copied it for ID '%s', source: %s, dest: %s (new update time: %s)" ,
			appLauncher.id , appLauncher.extractedIcon , extractIconPath ,
			appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
		) ;
		//log.hdebug( "BF appLauncher: %Y" , appLauncher.export() ) ;

		if ( appLauncher.icon ) {
			appLauncher.autoUpdateIconPath = appLauncher.icon ;
			appLauncher.autoUpdateIconIndex = appLauncher.iconIndex || null ;
		}

		appLauncher.icon = extractIconPath ;
		appLauncher.iconIndex = null ;
		//log.hdebug( "AFT appLauncher: %Y" , appLauncher.export() ) ;

		return ;
	}

	if ( appLauncher.autoUpdateIconPath ) {
		iconSourcePath = appLauncher.autoUpdateIconPath ;
		iconSourceIndex = appLauncher.autoUpdateIconIndex ;
	}
	else if ( appLauncher.icon ) {
		iconSourcePath = appLauncher.icon ;
		iconSourceIndex = appLauncher.iconIndex ;
	}
	else if ( appLauncher.getMainFile() ) {
		iconSourcePath = appLauncher.getMainFile() ;
		iconSourceIndex = null ;
	}
	else {
		if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }

		log.verbose( ".extractIcon(): No icon source found for ID '%s' (new update time: %s)" ,
			appLauncher.id ,
			appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
		) ;

		return ;
	}


	if ( iconSourcePath ) {
		let iconExtension = path.extname( iconSourcePath ).slice( 1 ).toLowerCase() ;

		// Note: If a .lnk is passed here, it is not substituted, instead we will either use its iconPath or its associated icon

		if ( ICON_EXTRACTION_EXTENSIONS.has( iconExtension ) ) {
			// For instance, all icon extractors can extract to .png
			extractIconPath = extractIconPathNoExt + '.png' ;

			log.verbose( ".extractIcon(): About to extract icon for ID '%s', source: %s, dest: %s (last update: %s)" ,
				appLauncher.id , iconSourcePath , extractIconPath ,
				appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
			) ;

			if ( await this.osSpecific.extractIcon( iconSourcePath , extractIconPath , + iconSourceIndex || 0 , 256 ) ) {
				if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }

				log.verbose( ".extractIcon(): Icon extraction successful for ID '%s' (new update time: %s)" ,
					appLauncher.id ,
					appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
				) ;

				appLauncher.icon = extractIconPath ;
				appLauncher.iconIndex = null ;
				appLauncher.autoUpdateIconPath = iconSourcePath ;
				appLauncher.autoUpdateIconIndex = iconSourceIndex ;

				return ;
			}

			log.error( ".extractIcon(): Icon extraction FAILED for ID '%s'" , appLauncher.id ) ;
		}
		else if ( ICON_IMAGE_EXTENSIONS.has( iconExtension ) ) {
			extractIconPath = extractIconPathNoExt + '.' + iconExtension ;

			// When updating, it's possible that the icon is already extracted correctly
			if ( path.dirname( iconSourcePath ) !== this.iconDir ) {
				await fsKit.copy( iconSourcePath , extractIconPath ) ;
			}

			if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }

			log.verbose( ".extractIcon(): Icon successfully copied for ID '%s', from: %s, to: %s (new update time: %s)" ,
				appLauncher.id , iconSourcePath , extractIconPath ,
				appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
			) ;

			appLauncher.icon = extractIconPath ;
			appLauncher.iconIndex = null ;
			appLauncher.autoUpdateIconPath = iconSourcePath ;
			appLauncher.autoUpdateIconIndex = null ;

			return ;
		}
	}

	log.verbose( ".extractIcon(): About to search for icon near the source: %s (last update: %s)" ,
		appLauncher.id , iconSourcePath ,
		appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
	) ;

	var iconFoundPath = await this.osSpecific.findIconFromFilePath( iconSourcePath ) ;

	if ( iconFoundPath ) {
		extractIconPath = extractIconPathNoExt + path.extname( iconFoundPath ).toLowerCase() ;

		await fsKit.copy( iconFoundPath , extractIconPath ) ;

		if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }

		log.verbose( ".extractIcon(): Icon successfully copied for ID '%s', found at: %s, dest: %s (new update time: %s)" ,
			appLauncher.id , iconFoundPath , extractIconPath ,
			appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
		) ;

		appLauncher.icon = extractIconPath ;
		appLauncher.iconIndex = null ;
		appLauncher.autoUpdateIconPath = iconFoundPath ;
		appLauncher.autoUpdateIconIndex = null ;

		return ;
	}

	// Nothing found, what should be done?
	appLauncher.icon = null ;
	appLauncher.iconIndex = null ;
	appLauncher.autoUpdateIconPath = null ;
	appLauncher.autoUpdateIconIndex = null ;

	// /!\ For instance, we will set the update timestamp nonetheless
	if ( appLauncher.meta ) { appLauncher.meta.lastIconUpdateTime = new Date() ; }

	log.error( ".extractIcon(): All icon retrievers FAILED for ID '%s' (new update time: %s)" ,
		appLauncher.id ,
		appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
	) ;
} ;



LauncherKit.prototype.autoUpdateIcon = async function( timeout = this.autoUpdateIconTimeout ) {
	var now = Date.now() ;

	for ( let id in this.appLaunchers ) {
		let appLauncher = this.appLaunchers[ id ] ;

		if (
			appLauncher.autoUpdateIconPath
			&& appLauncher.meta
			&& ( ! appLauncher.meta.lastIconUpdateTime || now - appLauncher.meta.lastIconUpdateTime >= timeout )
		) {
			// App having icon auto-update
			log.verbose( ".autoUpdateIcon(): Icon may need to be refreshed for ID '%s' (last update: %s)" ,
				appLauncher.id ,
				appLauncher.meta?.lastIconUpdateTime && appLauncher.meta.lastIconUpdateTime.toISOString()
			) ;
			await this.extractIcon( appLauncher ) ;
			await appLauncher.saveConfigIfChanged() ;
		}
		else if ( appLauncher.icon && ! await fsKit.isFile( appLauncher.icon ) ) {
			// Icon lost for whatever the reason (usually icons are stored in our folder, so it should not happen)
			log.warning( ".autoUpdateIcon(): Icon is gone for ID '%s': %s" , appLauncher.id , appLauncher.icon ) ;
			appLauncher.icon = null ;
			appLauncher.iconIndex = null ;
			await this.extractIcon( appLauncher ) ;
			await appLauncher.saveConfigIfChanged() ;
		}
		else if ( ! appLauncher.icon && ! appLauncher.isContent && ! appLauncher.isRom ) {
			log.warning( ".autoUpdateIcon(): No icon configured for ID '%s'" , appLauncher.id ) ;
			appLauncher.icon = null ;
			appLauncher.iconIndex = null ;
			await this.extractIcon( appLauncher ) ;
			await appLauncher.saveConfigIfChanged() ;
		}
	}
} ;

