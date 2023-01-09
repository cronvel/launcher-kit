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



const path = require( 'path' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const utils = require( '../../utils.js' ) ;
const AppLauncher = require( '../../AppLauncher.js' ) ;



function ShellLauncher( launcherKit , options = {} , appConfigPath = null ) {
	AppLauncher.call( this , launcherKit , options , appConfigPath ) ;
}

ShellLauncher.prototype = Object.create( AppLauncher.prototype ) ;
ShellLauncher.prototype.constructor = ShellLauncher ;

module.exports = ShellLauncher ;



/*
const win32EscapeShellArg = arg =>
	typeof arg === 'number' ? arg :
	'"' + arg.replace( /["]/g , str => '\\' + str ) + '"' ;
*/



ShellLauncher.prototype.buildSpawnOptions = function() {
	var shell ,
		wdir = this.ctx.wdir ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.exe , this.ctx ) , wdir , true ) ,
		args = this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) ) ;

	wdir = wdir ?? path.dirname( exe ) ;

	if ( process.platform === 'win32' ) {
		//let extension = path.extname( exe ).slice( 1 ) ;
		shell = 'cmd.exe' ;
		let shellArgs = [ '/c' ] ;

		return {
			exe: shell ,
			args: [ ... shellArgs , exe , ... args ] ,
			options: {
				detached: true ,
				cwd: wdir
			}
		} ;
	}

	// Linux...

	shell = process.env.SHELL || 'sh' ;

	return {
		exe: shell ,
		args: [ exe , ... args ] ,
		options: {
			detached: true ,
			cwd: wdir
		}
	} ;
} ;

