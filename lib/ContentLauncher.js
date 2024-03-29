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

const kungFig = require( 'kung-fig' ) ;
const Dynamic = kungFig.Dynamic ;

const path = require( 'path' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function ContentLauncher( launcherKit , params = {} , appConfigPath = null ) {
	BaseLauncher.call( this , launcherKit , params , appConfigPath ) ;

	this.content = params.content ;	// content path
	this.readerExe = params.readerExe ;	// reader path

	// By default, we use the 'open' method for launching content
	if ( ! this.use ) { this.use = 'open' ; }

	[ 'content' , 'readerExe' ].forEach( key => this.savedProperties.add( key ) ) ;

	this.schema.properties.content = { type: 'string' , input: { method: 'fileSelector' , label: 'content' } } ;
	this.schema.properties.readerExe = { type: 'string' , input: { method: 'fileSelector' , label: 'reader executable' } } ;
}

ContentLauncher.prototype = Object.create( BaseLauncher.prototype ) ;
ContentLauncher.prototype.constructor = ContentLauncher ;

module.exports = ContentLauncher ;



ContentLauncher.prototype.isContent = true ;
ContentLauncher.prototype.mainFileProperty = 'content' ;



ContentLauncher.prototype.buildSpawnOptions = function() {
	var wdir = this.ctx.wdir ,
		exe = utils.fixPath( Dynamic.getSafeFinalValue( this.readerExe , this.ctx ) , wdir , true ) ,
		args = [ Dynamic.getSafeFinalValue( this.content , this.ctx ) ] ;

	return {
		exe ,
		args ,
		options: {
			detached: true ,
			cwd: wdir ?? undefined
		}
	} ;
} ;

