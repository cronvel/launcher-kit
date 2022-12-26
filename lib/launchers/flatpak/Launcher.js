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

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function Launcher( launcherKit , options = {} , appConfigPath = null ) {
	AppLauncher.call( this , launcherKit , options , appConfigPath ) ;

	this.appId = options.appId ;	// Flatpak App ID, e.g.: org.wesnoth.Wesnoth

	//this.arch = options.arch || 'x86_64' ;
	//this.branch = options.branch || 'stable' ;

	this.savedProperties.add( 'appId' ) ;

	this.schema.properties.appId = { type: 'string' , input: { method: 'text' , label: 'flatpak app ID' } } ;
}

Launcher.prototype = Object.create( AppLauncher.prototype ) ;
Launcher.prototype.constructor = Launcher ;

module.exports = Launcher ;



Launcher.prototype.buildSpawnOptions = function() {
	var args = [ 'run' ] ;
	//args.push( '--branch=' + this.branch , '--arch=' + this.arch ) ;
	args.push( this.appId ) ;

	return {
		exe: 'flatpak' ,
		args ,
		options: {
			detached: true
			//cwd: this.directory ?? undefined
		}
	} ;
} ;

