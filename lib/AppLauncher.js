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

const path = require( 'path' ) ;
const childProcess = require( 'child_process' ) ;
const open = require( 'open' ) ;

const string = require( 'string-kit' ) ;
const Promise = require( 'seventh' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher' ) ;



function AppLauncher( launcherKit , options = {} , appConfigPath = null ) {
	this.launcherKit = launcherKit ;
	this.id = options.id || utils.nameToId( options.name || options.title ) ;	// Internal ID name (usually shorter)

	this.appConfigPath = appConfigPath ;
	this.appConfig = appConfigPath ? options : null ;

	if ( ! this.id ) { throw new Error( "Invalid or missing app ID" ) ; }

	this.rank = options.rank ?? null ;
	this.type = options.type ;
	this.use = options.use ;

	this.name = options.name || options.title || options.id || "noname" ;	// Display name, usually a short name (e.g.: Wesnoth)
	this.title = options.title || null ;	// Mostly like name, but usually the long name (e.g.: The Battle for Wesnoth)
	this.baseline = options.baseline || null ;	// Below/next to the name/title
	this.icon = options.icon || null ;	// Icon (small image)
	this.cover = options.cover || null ;	// Medium image (for button), something like 100x200
	this.banner = options.banner || null ;	// Large banner image

	this.directory = options.directory ;	// Working directory
	this.exe = options.exe ;
	this.args = options.args || [] ;
	this.env = options.env || null ;

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
	this.addCtx( 'wdir' , () => utils.fixPath( Dynamic.getSafeFinalValue( this.directory , this.ctx ) , this.launcherKit.homeDir ) ) ;

	this.savedProperties = new Set( [
		'id' , 'rank' , 'type' , 'use' ,
		'name' , 'title' , 'baseline' ,
		'directory' , 'exe' , 'args' ,
		'icon' , 'cover' , 'banner'
	] ) ;

	this.schema = {
		properties: {
			id: { type: 'string' , input: { method: 'text' , label: 'id' } } ,
			rank: { type: 'number' } ,
			type: { type: 'string' , input: { method: 'text' , label: 'type' } } ,
			use: { type: 'string' , input: { method: 'text' , label: 'use' } } ,
			name: { type: 'string' , input: { method: 'text' , label: 'name' } } ,
			title: { type: 'string' , input: { method: 'text' , label: 'title' } } ,
			baseline: { type: 'string' , input: { method: 'text' , label: 'baseline' } } ,
			directory: { type: 'string' , input: { method: 'directorySelector' , label: 'directory' } } ,
			exe: { type: 'string' , input: { method: 'fileSelector' , label: 'executable' } } ,
			args: { type: 'array' , input: { method: 'inputList' , label: 'arguments' } , of: { type: 'string' , input: { method: 'text' } } } ,
			icon: { type: 'string' , input: { method: 'fileSelector' , label: 'icon' , previewMethod: 'localImage' } } ,
			cover: { type: 'string' , input: { method: 'fileSelector' , label: 'cover' , previewMethod: 'localImage' } } ,
			banner: { type: 'string' , input: { method: 'fileSelector' , label: 'banner' , previewMethod: 'localImage' } }
		}
	} ;
}

module.exports = AppLauncher ;



AppLauncher.prototype.isContent = false ;
AppLauncher.prototype.mainFileProperty = 'exe' ;



AppLauncher.prototype.saveConfig = async function() {
	var key , update ;

	if ( ! this.appConfigPath || ! this.appConfig ) { return ; }

	for ( key of this.savedProperties ) {
		update =
			Array.isArray( this[ key ] ) && ! this[ key ].length && ! this.appConfig[ key ] ? false :
			this[ key ] !== null && this[ key ] !== undefined ? true :
			!! ( this[ key ] === null && this.appConfig[ key ] !== null && this.appConfig[ key ] !== undefined ) ;

		if ( update ) { this.appConfig[ key ] = this[ key ] ; }
	}

	await kungFig.saveKfg( this.appConfig , this.appConfigPath , { preferYesNo: true } ) ;
} ;



AppLauncher.prototype.addCtx = function( property , getter ) {
	Object.defineProperty( this.ctx , property , { enumerable: true , get: getter } ) ;
} ;



AppLauncher.prototype.isRunning = function() {
	return !! this.launchPromise ;
} ;



AppLauncher.prototype.launch = async function() {
	if ( this.launchPromise ) { return this.launchPromise ; }
	this.launchPromise = new Promise() ;

	var child ;

	if ( this.use === 'open' ) {
		this.startTime = Date.now() ;

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

		this.startTime = Date.now() ;

		log.verbose( "Running command: %s %J" , spawnOptions.exe , spawnOptions.args ) ;

		try {
			this.runningChild = child = childProcess.spawn( spawnOptions.exe , spawnOptions.args , spawnOptions.options ) ;
		}
		catch ( error ) {
			this.appLog.error( "Launch error: %E" , error ) ;
			this.launchPromise.reject( error ) ;
			return ;
		}
	}

	this.appPid = child.pid ;

	child.stdout.on( 'data' , str => {
		str = str.toString() ;
		this.appLog.verbose( "STDOUT: %s" , str.endsWith( '\n' ) ? str.slice( 0 , -1 ) : str ) ;
	} ) ;
	child.stderr.on( 'data' , str => {
		str = str.toString() ;
		this.appLog.verbose( "STDERR: %s" , str.endsWith( '\n' ) ? str.slice( 0 , -1 ) : str ) ;
	} ) ;

	child.on( 'error' , error => {
		this.appLog.error( "Child process error: %E" , error ) ;
	} ) ;

	//child.on( 'exit' , code => this.onExit( code ) ) ;
	child.on( 'exit' , code => {
		//log.hdebug( 'exit event' ) ;
		if ( ! this.ignoreExit ) { this.onExit( code ) ; }
	} ) ;

	this.appLog.info( "Starting %s..." , this.name ) ;

	await this.afterStart() ;

	return this.launchPromise ;
} ;



const SIGKILL_TIMEOUT = 10000 ;

// Could be derivated
AppLauncher.prototype.stop = async function() {
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



AppLauncher.prototype.killPid = async function( pid ) {
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



AppLauncher.prototype.onExit = function( code ) {
	// Already finished from elsewhere?
	if ( ! this.launchPromise ) { return ; }

	this.lastChild = this.runningChild ;
	this.runningChild = null ;
	this.appPid = null ;
	this.lastRunTime = Date.now() - this.startTime ;
	this.appLog.info( "%s exited with code %s, run time: %[a]t." , string.toTitleCase( this.name ) , code , this.lastRunTime ) ;

	// We have to nullify this.launchPromise BEFORE resolving to avoid race conditions
	var promise = this.launchPromise ;
	this.launchPromise = null ;

	// Await for it or not?
	this.afterExit() ;

	promise.resolve() ;
} ;



// Should be derivated
AppLauncher.prototype.buildSpawnOptions = function() {
	var wdir = this.ctx.wdir ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.exe , this.ctx ) , wdir , true ) ,
		args = this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) ) ;

	//log.hdebug( "%Y" , { wdir , exe , args } ) ;

	return {
		exe ,
		args ,
		options: {
			cwd: wdir ?? path.dirname( exe )
		}
	} ;
} ;



// Should be derivated
AppLauncher.prototype.afterStart = async function() {} ;
AppLauncher.prototype.afterExit = async function() {} ;

