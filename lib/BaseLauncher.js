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
const AppMeta = require( './AppMeta.js' ) ;

const childProcess = require( 'child_process' ) ;
const open = require( 'open' ) ;

const string = require( 'string-kit' ) ;
const doormen = require( 'doormen' ) ;
const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const Promise = require( 'seventh' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function BaseLauncher( launcherKit , options = {} , appConfigPath = null ) {
	this.launcherKit = launcherKit ;
	this.id = options.id || utils.nameToId( options.name || options.title ) ;	// Internal ID name (usually shorter)

	if ( ! this.id ) { throw new Error( "Invalid or missing app ID" ) ; }

	this.appConfigPath = appConfigPath ;
	this.appConfig = appConfigPath ? options : null ;

	this.meta = options.meta instanceof AppMeta ? options.meta : null ;	// Don't create one, since it has to be part of LauncherKit#meta sub-hierarchy

	this.rank = options.rank ?? null ;
	this.type = options.type ;
	this.use = options.use ;

	this.name = options.name || options.title || options.id || "noname" ;	// Display name, usually a short name (e.g.: Wesnoth)
	this.title = options.title || null ;	// Mostly like name, but usually the long name (e.g.: The Battle for Wesnoth)
	this.baseline = options.baseline || null ;	// Below/next to the name/title
	this.description = options.description || null ;	// Full description of the app
	this.icon = options.icon || null ;	// Icon, small square image
	this.iconIndex = options.iconIndex || null ;	// Icon index in the icon file
	this.cover = options.cover || null ;	// Medium image, replacement for icons in more elaborated GUIs, ususally of ratio 3:2 or 2:3, or even 2:1 or 1:2
	this.banner = options.banner || null ;	// Large banner image, mostly used for header of page dedicated to the app, or can be background image, etc...

	this.autoUpdateIconPath = options.autoUpdateIconPath || null ;
	this.autoUpdateIconIndex = options.autoUpdateIconIndex || null ;

	// This is temporary, the icon was pre-extracted (e.g. by LauncherKit#getInstalledAppList())
	this.extractedIcon = options.extractedIcon || null ;

	// Config and real-time data for the gui host
	this.gui = {} ;
	this.guiLive = {} ;

	this.launchPromise = null ;
	this.runningChild = null ;
	this.appPid = null ;
	this.lastChild = null ;
	this.startTime = null ;
	this.lastRunTime = null ;

	this.ignoreExit = false ;
	this.useKillWithAppPid = false ;

	this.appLog = Logfella.global.use( this.id ) ;

	this.ctx = {} ;
	this.addCtx( 'home' , () => this.launcherKit.homeDir ) ;

	this.savedProperties = new Set( [
		'id' , 'rank' , 'type' , 'use' ,
		'name' , 'title' , 'baseline' , 'description' ,
		'icon' , 'iconIndex' , 'cover' , 'banner' ,
		'autoUpdateIconPath' , 'autoUpdateIconIndex' ,
		'gui'
	] ) ;

	this.schema = {
		properties: {
			id: { type: 'string' , tags: [ 'internal' ] , input: { readOnly: true , method: 'text' , label: 'id' } } ,
			rank: { type: 'number' , tags: [ 'cosmetic' ] , input: { hidden: true } } ,
			type: { type: 'string' , tags: [ 'advanced' ] , input: { method: 'text' , label: 'type' } } ,
			use: { type: 'string' , tags: [ 'advanced' ] , input: { method: 'text' , label: 'use' } } ,
			name: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'text' , label: 'name' } } ,
			title: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'text' , label: 'title' } } ,
			baseline: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'text' , label: 'baseline' } } ,
			description: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'text' , label: 'description' } } ,
			icon: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'fileSelector' , label: 'icon' , previewMethod: 'localImage' } } ,
			iconIndex: { type: 'number' , tags: [ 'cosmetic' , 'advanced' ] , optional: true } ,
			cover: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'fileSelector' , label: 'cover' , previewMethod: 'localImage' } } ,
			banner: { type: 'string' , tags: [ 'cosmetic' ] , input: { method: 'fileSelector' , label: 'banner' , previewMethod: 'localImage' } } ,
			autoUpdateIconPath: { type: 'string' , optional: true , tags: [ 'advanced' ] } ,	// If set, then extracting icon from that source will be tried on a regular basis
			autoUpdateIconIndex: { type: 'number' , optional: true , tags: [ 'advanced' ] } ,	// If set, this is the index of the icon to extract from the source
			gui: { type: 'object' , optional: true , tags: [ 'cosmetic' ] }
		}
	} ;
}

module.exports = BaseLauncher ;



BaseLauncher.prototype.isContent = false ;
BaseLauncher.prototype.isRom = false ;

BaseLauncher.prototype.mainFileProperty = null ;
BaseLauncher.prototype.getMainFile = function() { return this[ this.mainFileProperty ] ; } ;
BaseLauncher.prototype.setMainFile = function( value ) {
	if ( ! this.mainFileProperty ) { return ; }
	this[ this.mainFileProperty ] = value ;
} ;



BaseLauncher.prototype.saveConfig = async function( onlyIfChanged = false ) {
	var hasUpdate = false ;

	if ( ! this.appConfigPath || ! this.appConfig ) { return ; }

	for ( let key of this.savedProperties ) {
		let oldExists = key in this.appConfig ;
		let oldValue = utils.configValueCoercion( this.appConfig[ key ] ) ;
		let newValue = utils.configValueCoercion( this[ key ] ) ;

		if ( ! doormen.isEqual( newValue , oldValue ) || ( oldExists && newValue === undefined ) ) {
			//if ( onlyIfChanged ) { log.hdebug( "Key '%s' changed: from %n to %n" , key , oldValue , newValue ) ; }
			if ( newValue === undefined ) { delete this.appConfig[ key ] ; }
			else { this.appConfig[ key ] = newValue ; }

			hasUpdate = true ;
		}
	}

	for ( let key in this.appConfig ) {
		if ( ! this.savedProperties.has( key ) ) {
			//if ( onlyIfChanged ) { log.hdebug( "Obsolete key '%s' removed" , key ) ; }
			delete this.appConfig[ key ] ;
			hasUpdate = true ;
		}
	}

	if ( onlyIfChanged && ! hasUpdate ) { return false ; }

	// Re-create a new appConfig, so it will re-order the object's properties, to have a cleaner KFG
	var newAppConfig = {} ;
	for ( let key of this.savedProperties ) { newAppConfig[ key ] = this.appConfig[ key ] ; }
	this.appConfig = newAppConfig ;

	await kungFig.saveKfgAsync( this.appConfig , this.appConfigPath , { preferYesNo: true } ) ;

	return true ;
} ;

BaseLauncher.prototype.saveConfigIfChanged = function() { return this.saveConfig( true ) ; } ;



const EXPORT_EXTRA_PROPERTIES = [ 'appConfigPath' , 'extractedIcon' ] ;

BaseLauncher.prototype.export = function() {
	var object = {} ;
	for ( let key of this.savedProperties ) { object[ key ] = this[ key ] ; }
	for ( let key of EXPORT_EXTRA_PROPERTIES ) { object[ key ] = this[ key ] ; }
	return object ;
} ;



BaseLauncher.prototype.addCtx = function( property , getter ) {
	Object.defineProperty( this.ctx , property , { enumerable: true , get: getter } ) ;
} ;



BaseLauncher.prototype.isRunning = function() {
	return !! this.launchPromise ;
} ;



BaseLauncher.prototype.setMeta = function( meta ) {
	if ( ! ( meta instanceof AppMeta ) ) {
		throw new TypeError( "BaseLauncher#setMeta(): not an instance of AppMeta" ) ;
	}

	this.meta = meta ;
} ;



BaseLauncher.prototype.launch = async function() {
	if ( this.launchPromise ) { return this.launchPromise ; }
	this.launchPromise = new Promise() ;

	var child , spawned = false ;

	if ( this.use === 'open' ) {
		let contentPath = Dynamic.getSafeFinalValue( this.content , this.ctx ) ;
		log.verbose( "Calling 'open' on: %s" , contentPath ) ;

		try {
			this.runningChild = child = await open( contentPath ) ;
		}
		catch ( error ) {
			this.appLog.error( "Launch error (open): %E" , error ) ;
			this.launchPromise.reject( error ) ;
			return ;
		}
	}
	else {
		let spawnOptions = this.buildSpawnOptions() ;

		// Can't force detached, it failed with appx@powershell
		//spawnOptions.options.detached = true ;

		log.verbose( "Running command: %s %J %J" , spawnOptions.exe , spawnOptions.args , spawnOptions.options ) ;

		try {
			this.runningChild = child = childProcess.spawn( spawnOptions.exe , spawnOptions.args , spawnOptions.options ) ;
		}
		catch ( error ) {
			this.appLog.error( "Launch error: %E" , error ) ;
			this.launchPromise.reject( error ) ;
			return ;
		}
	}

	// Child processes created by .open() don't have .stdout nor .stderr
	if ( child.stdout ) {
		child.stdout.on( 'data' , str => {
			str = str.toString() ;
			this.appLog.verbose( "STDOUT: %s" , str.endsWith( '\n' ) ? str.slice( 0 , -1 ) : str ) ;
		} ) ;
	}

	if ( child.stderr ) {
		child.stderr.on( 'data' , str => {
			str = str.toString() ;
			this.appLog.verbose( "STDERR: %s" , str.endsWith( '\n' ) ? str.slice( 0 , -1 ) : str ) ;
		} ) ;
	}

	child.on( 'error' , error => {
		if ( ! spawned ) {
			// THIS MEANS 'exit' WILL NOT BE CALLED!
			this.appLog.error( "Launch error: %E" , error ) ;
			this.launchPromise.reject( error ) ;
			return ;
		}

		this.appLog.error( "Child process error: %E %J" , error , error.code ) ;
	} ) ;

	// CAREFUL: 'exit' is not called if the process was not started (e.g. ENOENT does not throw on .spawn(), but emit an error on next event loop)
	child.on( 'exit' , code => {
		if ( this.ignoreExit ) { this.appLog.info( "%s's process exited with code %s." , string.toTitleCase( this.name ) , code ) ; }
		else { this.onExit( code ) ; }
	} ) ;

	// 'spawn' is a new event added in Node v15
	child.on( 'spawn' , () => {
		this.startTime = Date.now() ;
		this.appPid = child.pid ;
		this.appLog.info( "Starting %s..." , this.name ) ;
		spawned = true ;
		this.afterStart() ;	// Return a promise, but we don't care about it right now
	} ) ;

	// Cause the event loop to not include the child in its reference count, allowing to exit independently of the child
	child.unref() ;

	return this.launchPromise ;
} ;



BaseLauncher.prototype.onExit = function( code ) {
	// Already finished from elsewhere?
	if ( ! this.launchPromise ) { return ; }

	var stopTime = Date.now() ;

	this.lastChild = this.runningChild ;
	this.runningChild = null ;
	this.appPid = null ;
	this.lastRunTime = stopTime - this.startTime ;
	this.appLog.info( "%s exited with code %s, run time: %[a]t." , string.toTitleCase( this.name ) , code , this.lastRunTime ) ;

	if ( this.meta ) {
		this.meta.addSession( this.startTime , stopTime , code ) ;
	}

	// We have to nullify this.launchPromise BEFORE resolving to avoid race conditions
	var promise = this.launchPromise ;
	this.launchPromise = null ;

	// Await for it or not?
	this.afterExit() ;

	promise.resolve() ;
} ;



const SIGKILL_TIMEOUT = 10000 ;

// Could be derivated
BaseLauncher.prototype.stop = async function() {
	if ( ! this.launchPromise ) { return ; }

	if ( this.useKillWithAppPid && this.appPid ) {
		await this.killPid( this.appPid ) ;
		return ;
	}

	if ( this.runningChild.kill() ) { return ; }

	await Promise.resolveTimeout( 100 ) ;
	if ( ! this.launchPromise ) { return ; }

	await Promise.resolveTimeout( SIGKILL_TIMEOUT ) ;
	if ( ! this.launchPromise ) { return ; }

	this.runningChild.kill( 'SIGKILL' ) ;
} ;



BaseLauncher.prototype.killPid = async function( pid ) {
	try {
		await utils.exec( 'kill' , [ pid ] ) ;
	}
	catch ( error ) {
		// Already gone...
		return ;
	}

	await Promise.resolveTimeout( 100 ) ;
	if ( ! this.launchPromise ) { return ; }

	await Promise.resolveTimeout( SIGKILL_TIMEOUT ) ;
	if ( ! this.launchPromise ) { return ; }

	try {
		await utils.exec( 'kill' , [ '-9' , pid ] ) ;
	}
	catch ( error ) {}	// We don't care if it's already gone
} ;



// Should be derivated
BaseLauncher.prototype.buildSpawnOptions = function() {} ;
BaseLauncher.prototype.afterStart = async function() {} ;
BaseLauncher.prototype.afterExit = async function() {} ;

