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



const AppMeta = require( './AppMeta.js' ) ;

const kungFig = require( 'kung-fig' ) ;
//const Dynamic = kungFig.Dynamic ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function Meta( params = {} ) {
	if ( ! params || typeof params !== 'object' ) { throw new TypeError( 'Meta(): bad params, not an object' ) ; }

	// Last time the lib was running on this config
	this.lastStartupTime = params.lastStartupTime instanceof Date ? params.lastStartupTime : null ;
	this.lastShutdownTime = params.lastShutdownTime instanceof Date ? params.lastShutdownTime : null ;

	this.gui = params.gui && typeof params.gui === 'object' ? params.gui : {} ;

	// key: app's id, value: AppMeta instance
	this.appMeta = {} ;
	if ( params.appMeta && typeof params.appMeta === 'object' ) {
		for ( let appId in params.appMeta ) {
			this.appMeta[ appId ] = new AppMeta( params.appMeta[ appId ] ) ;
		}
	}
}

module.exports = Meta ;



Meta.prototype.save = async function( filepath ) {
	if ( ! filepath ) { return ; }

	await kungFig.saveKfgAsync( this , filepath , { preferYesNo: true } ) ;
} ;



Meta.load = async function( filepath ) {
	if ( ! filepath ) { return ; }

	var content = await kungFig.loadAsync( filepath ) ;
	log.hdebug( "Meta content: %n" , content ) ;
	return new Meta( content ) ;
} ;

