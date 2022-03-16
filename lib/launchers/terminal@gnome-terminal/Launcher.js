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

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'terminal@gnome-terminal-launcher' ) ;



function Launcher( megaLauncher , options = {} , appConfigPath = null ) {
	AppLauncher.call( this , megaLauncher , options , appConfigPath ) ;
	this.terminalExe = options.terminalExe || 'gnome-terminal' ;
	this.terminalArgs = options.terminalArgs || [ '--wait' , '--' ] ;

	[ 'terminalExe' , 'terminalArgs' ].forEach( key => this.savedProperties.add( key ) ) ;

	this.schema.properties.terminalExe = { type: 'string' , input: { method: 'fileSelector' , label: 'terminal executable' } } ;
	this.schema.properties.terminalArgs = { type: 'array' , of: { type: 'string' , input: { method: 'text' , label: 'terminal arguments' } } } ;
}

Launcher.prototype = Object.create( AppLauncher.prototype ) ;
Launcher.prototype.constructor = Launcher ;

module.exports = Launcher ;



Launcher.prototype.buildSpawnOptions = function() {
	var wdir = this.ctx.wdir ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.terminalExe , this.ctx ) , wdir , true ) ,
		trueExe = utils.fixPath( Dynamic.getSafeFinalValue( this.exe , this.ctx ) , wdir , true ) ,
		args = [
			... this.terminalArgs ,
			trueExe ,
			... this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) )
		] ;

	return {
		exe ,
		args ,
		options: {
			cwd: wdir ?? undefined
		}
	} ;
} ;

