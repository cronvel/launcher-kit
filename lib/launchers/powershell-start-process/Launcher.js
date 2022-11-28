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
	Start an exe using Windows Powershell's Start-Process command.
	Can be used to start .lnk links pointing to a program.
*/



const path = require( 'path' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const utils = require( '../../utils.js' ) ;
const AppLauncher = require( '../../AppLauncher.js' ) ;



function Launcher( launcherKit , options = {} , appConfigPath = null ) {
	AppLauncher.call( this , launcherKit , options , appConfigPath ) ;
}

Launcher.prototype = Object.create( AppLauncher.prototype ) ;
Launcher.prototype.constructor = Launcher ;

module.exports = Launcher ;



Launcher.prototype.buildSpawnOptions = function() {
	if ( process.platform !== 'win32' ) { return null ; }

	var command = 'Start-Process' ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.exe , this.ctx ) , wdir , true ) ,
		wdir = this.ctx.wdir ,
		args = this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) ) ;

	wdir = wdir ?? path.dirname( exe ) ;

	return {
		exe: command ,
		args: [
			'-FilePath' , exe ,
			'-WorkingDirectory' , wdir ,
			... args
		] ,
		options: {
			shell: "powershell.exe"
			//cwd: wdir
		}
	} ;
} ;

