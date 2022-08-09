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



const kungFig = require( 'kung-fig' ) ;
//const Dynamic = kungFig.Dynamic ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;



function Meta( params = {} , filepath = null ) {
	params = params ?? {} ;

	this.filepath = filepath ;
	this.savedMeta = {} ;

	this.targetDate = null ;
	this.targetSize = null ;
}

module.exports = Meta ;



const SAVED_PROPERTIES = new Set( [
	'targetDate' , 'targetSize'
] ) ;



Meta.prototype.save = async function() {
	if ( ! this.filepath ) { return ; }

	for ( let key of SAVED_PROPERTIES ) {
		let update =
			Array.isArray( this[ key ] ) && ! this[ key ].length && ! this.savedMeta[ key ] ? false :
			this[ key ] !== null && this[ key ] !== undefined ? true :
			!! ( this[ key ] === null && this.savedMeta[ key ] !== null && this.savedMeta[ key ] !== undefined ) ;

		if ( update ) { this.savedMeta[ key ] = this[ key ] ; }
	}

	await kungFig.saveKfgAsync( this.savedMeta , this.filepath , { preferYesNo: true } ) ;
} ;



Meta.load = async function( filepath ) {
	if ( ! filepath ) { return ; }

	var content = await kungFig.loadAsync( filepath ) ;

	if ( ! content || typeof content !== 'object' ) { throw new TypeError( 'Meta#load(): bad content, not an object' ) ; }
	log.hdebug( "Meta loaded: %n" , content ) ;

	var meta = new Meta( undefined , filepath ) ;

	for ( let key in content ) {
		if ( ! SAVED_PROPERTIES.has( key ) ) { continue ; }
		meta[ key ] = meta.savedMeta[ key ] = content[ key ] ;
	}

	return meta ;
} ;

