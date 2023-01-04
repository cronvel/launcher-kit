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

	this.appId = options.appId ;	// PackageFamilyName + "!App", e.g.: Microsoft.WindowsCalculator_8wekyb3d8bbwe!App

	this.savedProperties.add( 'appId' ) ;

	this.schema.properties.appId = { type: 'string' , input: { method: 'text' , label: 'App ID (AppX PackageFamilyName + "!App"' } } ;
}

Launcher.prototype = Object.create( AppLauncher.prototype ) ;
Launcher.prototype.constructor = Launcher ;

module.exports = Launcher ;



// There is no main file at all
Launcher.prototype.mainFileProperty = null ;



// From @cronvel/ms-kit:lib/powershell.js
//const escapePowershellArg_ = arg => arg.replace( /["*~;()%?.:@/\\ -]/g , str => '`' + str ) ;
const escapePowershellArg = arg =>
	typeof arg === 'number' ? arg :
	'"' + arg.replace( /["]/g , str => '\\' + str ) + '"' ;



Launcher.prototype.buildSpawnOptions = function() {
	if ( process.platform !== 'win32' ) { return null ; }

	var command = 'Start-Process' ,
		target = 'Shell:AppsFolder\\' + Dynamic.getSafeFinalValue( this.appId , this.ctx ) ;

	return {
		exe: command ,
		args: [ target ] ,
		options: {
			shell: "powershell.exe"
		}
	} ;
} ;

