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



const BaseLauncher = require( './BaseLauncher.js' ) ;
const utils = require( './utils.js' ) ;

const path = require( 'path' ) ;
const shellQuote = require( 'shell-quote' ) ;

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function AppLauncher( launcherKit , options = {} , appConfigPath = null ) {
	BaseLauncher.call( this , launcherKit , options , appConfigPath ) ;

	this.exe = options.exe ;

	this.args =
		Array.isArray( options.args ) ? options.args :
		typeof options.args === 'string' ? shellQuote.parse( options.args ) :
		[] ;

	this.directory = options.directory ;	// Working directory
	this.addCtx( 'wdir' , () => utils.fixPath( Dynamic.getSafeFinalValue( this.directory , this.ctx ) , this.launcherKit.homeDir ) ) ;

	this.env = options.env || null ;	// Not use ATM, but could/should be used later

	[ 'exe' , 'args' , 'directory' ].forEach( key => this.savedProperties.add( key ) ) ;

	this.schema.properties.exe = { type: 'string' , input: { method: 'fileSelector' , label: 'executable' } } ;
	this.schema.properties.args = { type: 'array' , input: { method: 'inputList' , label: 'arguments' } , of: { type: 'string' , input: { method: 'text' } } } ;
	this.schema.properties.directory = { type: 'string' , input: { method: 'directorySelector' , label: 'directory' } } ;
}

AppLauncher.prototype = Object.create( BaseLauncher.prototype ) ;
AppLauncher.prototype.constructor = AppLauncher ;

module.exports = AppLauncher ;



AppLauncher.prototype.mainFileProperty = 'exe' ;



AppLauncher.prototype.buildSpawnOptions = function() {
	var wdir = this.ctx.wdir ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.exe , this.ctx ) , wdir , true ) ,
		args = this.args.map( arg => Dynamic.getSafeFinalValue( arg , this.ctx ) ) ;

	wdir = wdir ?? path.dirname( exe ) ;
	//log.hdebug( "%Y" , { wdir , exe , args } ) ;

	return {
		exe ,
		args ,
		options: {
			detached: true ,
			cwd: wdir
		}
	} ;
} ;

