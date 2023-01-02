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



/*
	Start an .lnk file using Windows Powershell's Start-Process command.
*/



const path = require( 'path' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const utils = require( '../../utils.js' ) ;
const AppLauncher = require( '../../AppLauncher.js' ) ;



function Launcher( launcherKit , options = {} , appConfigPath = null ) {
	AppLauncher.call( this , launcherKit , options , appConfigPath ) ;

	this.target = options.target ;

	this.savedProperties.add( 'target' ) ;

	this.schema.properties.target = { type: 'string' , input: { method: 'text' , label: 'target to launch (exe or lnk)' } } ;
}

Launcher.prototype = Object.create( AppLauncher.prototype ) ;
Launcher.prototype.constructor = Launcher ;

module.exports = Launcher ;



AppLauncher.prototype.mainFileProperty = 'target' ;



// From @cronvel/ms-kit:lib/powershell.js
//const escapePowershellArg_ = arg => arg.replace( /["*~;()%?.:@/\\ -]/g , str => '`' + str ) ;
const escapePowershellArg = arg =>
	typeof arg === 'number' ? arg :
	'"' + arg.replace( /["]/g , str => '\\' + str ) + '"' ;



Launcher.prototype.buildSpawnOptions = function() {
	if ( process.platform !== 'win32' ) { return null ; }

	var command = 'Start-Process' ,
		target = utils.fixPath( Dynamic.getSafeFinalValue( this.target , this.ctx ) , wdir , true ) ,
		wdir = this.ctx.wdir ,
		args = this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) ) ;

	wdir = wdir ?? path.dirname( target ) ;

	return {
		exe: command ,
		args: [
			'-FilePath' , escapePowershellArg( target ) ,
			'-WorkingDirectory' , escapePowershellArg( wdir ) ,
			... args.map( escapePowershellArg )
		] ,
		options: {
			shell: "powershell.exe"
			//cwd: wdir
		}
	} ;
} ;

