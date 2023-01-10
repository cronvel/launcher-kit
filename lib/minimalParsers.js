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

// This is a collection of incomplete and hacky parsers,
// they have to be just good enough for Launcher-Kit to use them.



// Parse valve VDF (ValueKey format), that is used for .vdf and .acf, used by Steam
const VDF_REGEXP = /^"((?:\\"|[^"])*)"(?:\s+"((?:\\"|[^"])*)")?$/ ;

exports.parseVDF = ( str ) => {
	var hangingKey = '' ,
		lines = str.split( /\r?\n/g ).map( line => line.trim() ) ,
		object = {} ,
		stack = [] ,
		ptr = object ;

	for ( let line of lines ) {
		if ( ! line || line[ 0 ] === '/' || line[ 0 ] === '#' ) {
			// "/" or "//" introduce comment and can be ignored,
			// "#" introduce include and are not supported
			continue ;
		}

		if ( line === '{' ) {
			let child = {} ;
			//ptr[ hangingKey ] = child ;
			stack.push( [ hangingKey , ptr ] ) ;
			ptr = child ;
		}
		else if ( line === '}' ) {
			if ( ! stack.length ) {
				throw new SyntaxError( "The VDF parser encountered a parse error: unmatched closing brace" ) ;
			}

			let child = ptr ;
			
			// Detect array if all keys are string like 0,1,2,3,...
			let index = 0 ;
			if ( Object.keys( ptr ).every( k => k === '' + ( index ++ ) ) ) {
				child = Object.values( ptr ) ;
			}

			[ hangingKey , ptr ] = stack.pop() ;
			ptr[ hangingKey ] = child ;
		}
		else {
			let match = line.match( VDF_REGEXP ) ;
			if ( ! match ) {
				console.error( "Doesn't match: '" + line + "'" ) ;
				return null ;
			}

			if ( match[ 2 ] ) {
				// This is a key/value
				let value = match[ 2 ] ;

				if ( value.match( /^[0-9]+(?:\.[0-9]+)?$/ ) ) {
					// Number detected
					value = parseFloat( value ) ;
				}

				ptr[ match[ 1 ] ] = value ;
			}
			else {
				// It's probably a nested object, next line should be a '{'
				hangingKey = match[ 1 ] ;
			}
		}
	}

	return object ;
} ;

