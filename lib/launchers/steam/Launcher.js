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



const AppLauncher = require( '../../AppLauncher.js' ) ;
const utils = require( '../../utils.js' ) ;

const childProcess = require( 'child_process' ) ;

const string = require( 'string-kit' ) ;
const Promise = require( 'seventh' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'steam-launcher' ) ;



/*
	Command to list steam app IDs:
	"grep -n \"name\" ~/.local/share/Steam/steamapps/*.acf | sed -e 's/^.*_//;s/\\.acf:.:/ /;s/name//;s/\"//g;s/\\t//g;s/ /-/' | awk -F\"-\" '{printf \"%-40s %s\\n\", \$2, \$1}' | sort"

	To run a game through steam:
	steam steam://rungameid/<appId>

	If the game have args:
	steam steam://run/<appId>//<args>/

	Running "ps -h -o pid -o cmd", search for the line containing "/reaper SteamLaunch AppId=<appId> --", this give us the exe path and the parent PID, e.g.:
	16211 /home/cedric/.local/share/Steam/ubuntu12_32/reaper SteamLaunch AppId=212680 -- /home/cedric/.local/share/Steam/steamapps/common/FTL Faster Than Light/FTL
	Then run "ps -h -o pid -o cmd --ppid 16211" to find all child process of this one, the path may have changed if the previous exe has run another exe, e.g.:
	16212 /home/cedric/.local/share/Steam/steamapps/common/FTL Faster Than Light/data/FTL.amd64

	Once you got the pid, you can watch it to know when it has exited.

	Then you can close steam using "steam -shutdown"
*/

function Launcher( launcherKit , options = {} , appConfigPath = null ) {
	AppLauncher.call( this , launcherKit , options , appConfigPath ) ;

	this.appId = options.appId || null ;	// Steam App ID, a number
	this.appName = options.appName || null ;	// Steam App name
	this.steamless = !! options.steamless ;	// Try to run without steam, require .exe

	// Auto-close steam when the game has closed
	this.autoCloseSteam =
		this.steamless ? false :
		options.autoCloseSteam !== false ;

	// Steam closes the child process, so we have to rely on the detected pid instead...
	this.ignoreExit = ! this.steamless ;
	this.useKillWithAppPid = true ;

	[
		'appId' , 'appName' , 'steamless' , 'autoCloseSteam'
	].forEach( key => this.savedProperties.add( key ) ) ;

	this.schema.properties.appId = { type: 'string' , input: { method: 'text' , label: 'steam app ID' } } ;
	this.schema.properties.appName = { type: 'string' , input: { method: 'text' , label: 'steam app name' } } ;
	this.schema.properties.steamless = { type: 'boolean' , input: { method: 'switch' , label: 'run without steam' } } ;
	this.schema.properties.autoCloseSteam = { type: 'boolean' , input: { method: 'switch' , label: 'auto close steam' } } ;
}

Launcher.prototype = Object.create( AppLauncher.prototype ) ;
Launcher.prototype.constructor = Launcher ;

module.exports = Launcher ;



Launcher.prototype.buildSpawnOptions = function() {
	if ( this.steamless ) { return AppLauncher.prototype.buildSpawnOptions.call( this ) ; }

	var args ,
		appArgs = this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) ) ;

	if ( appArgs.length ) {
		args = [ 'steam://run/' + this.appId + '//' + appArgs.map( string.escape.shellArg ).join( ' ' ) + '/' ] ;
	}
	else {
		args = [ 'steam://rungameid/' + this.appId ] ;
	}

	return { exe: 'steam' , args } ;
} ;



Launcher.prototype.afterStart = async function() {
	if ( this.steamless ) { return ; }

	var stdout , match , reaperPid ;

	// In any case, clear pid, we don't care about steam's launcher pid
	this.appPid = null ;

	while ( ! match ) {
		//log.hdebug( "Retry A... (appId: %s)" , this.appId ) ;
		await Promise.resolveTimeout( 1000 ) ;
		//stdout = ( await utils.exec( 'ps -h -o pid -o cmd' ) ).stdout ;
		stdout = ( await utils.exec( 'ps' , [ '-h' , '-o' , 'pid' , '-o' , 'cmd' ] ) ).stdout ;
		//log.hdebug( "stdout: \n%s" , stdout ) ;
		match = stdout.match( new RegExp( '^\\s*([0-9]+)\\s+[^\\s]+/reaper SteamLaunch AppId=' + this.appId + ' -- (.+)$' , 'm' ) ) ;
	}

	reaperPid = parseInt( match[ 1 ] , 10 ) ;
	this.exe = match[ 2 ] ;
	log.verbose( "Found reaper pid: %d, real exe is: %s" , reaperPid , match[ 2 ] ) ;

	match = null ;

	while ( ! match ) {
		//log.hdebug( "Retry B..." ) ;
		await Promise.resolveTimeout( 1000 ) ;
		//stdout = ( await utils.exec( 'ps -h -o pid -o cmd --ppid ' + reaperPid ) ).stdout ;
		stdout = ( await utils.exec( 'ps' , [ '-h' ,  '-o' , 'pid' , '-o' , 'cmd' , '--ppid' , reaperPid ] ) ).stdout ;
		//log.hdebug( "stdout: \n%s" , stdout ) ;
		match = stdout.match( /^\s*([0-9]+)\s+(.+)$/m ) ;
	}

	this.appPid = parseInt( match[ 1 ] , 10 ) ;
	//this.exe = match[ 2 ] ;
	log.verbose( "Found real exe pid: %d, real exe is: %s" , this.appPid , match[ 2 ] ) ;

	if ( this.appConfig && ! this.appConfig.exe ) {
		this.saveConfig() ;
	}

	utils.waitForMissingPid( this.appPid ).then( () => {
		log.verbose( "Pid %d is gone, exit detected..." , this.appPid ) ;
		this.onExit() ;
	} ) ;
} ;



Launcher.prototype.afterExit = async function() {
	if ( this.steamless ) { return ; }

	try {
		log.info( "Shutting down steam..." ) ;
		await utils.exec( 'steam -shutdown' ) ;
	}
	catch ( error ) {
		log.error( "Steam shutdown error: %E" , error ) ;
	}
} ;

