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
const childProcess = require( 'child_process' ) ;
const userHomeDir = require( 'os' ).homedir() ;

const string = require( 'string-kit' ) ;
const Promise = require( 'seventh' ) ;
const fsKit = require( 'fs-kit' ) ;

const Logfella = require( 'logfella' ) ;
const log = Logfella.global.use( 'launcher-kit' ) ;

const utils = exports ;



// Promisified exec/execFile (shell/no shell)
exports.exec = ( command , args , options ) => {
	var promise = new Promise() ;

	var onExit = ( error , stdout , stderr ) => {
		if ( error ) {
			error.stdout = stdout ;
			error.stderr = stderr ;
			promise.reject( error ) ;
			return ;
		}

		promise.resolve( { code: 0 , stdout , stderr } ) ;
	} ;

	if ( args === true ) {
		childProcess.execFile( command , options , onExit ) ;
	}
	else if ( Array.isArray( args ) ) {
		childProcess.execFile( command , args , options , onExit ) ;
	}
	else {
		childProcess.exec( command , options , onExit ) ;
	}

	return promise ;
} ;



exports.waitForMissingPid = async function( pid , timeout = 2000 ) {
	var stdout ;

	for ( ;; ) {
		//log.hdebug( "Retry C... (pid: %s)" , pid ) ;
		await Promise.resolveTimeout( timeout ) ;

		try {
			stdout = await utils.exec( 'ps -h -o pid -o cmd --pid ' + pid ) ;
			//log.hdebug( "OK, stdout: \n%s" , stdout ) ;
		}
		catch ( error ) {
			// This is the normal case: ps exit with an error code
			//log.error( "error: %E" , error ) ;
			break ;
		}
	}
} ;



exports.fixPath = ( path_ , relativeTo , isExe = false ) => {
	if ( typeof path_ !== 'string' ) { return path_ ; }

	if ( ! relativeTo ) { relativeTo = userHomeDir ; }

	if ( path_.startsWith( '/' ) ) { return path_ ; }
	if ( path_.startsWith( '~/' ) ) { return userHomeDir + path_.slice( 1 ) ; }
	if ( path_.startsWith( './' ) || path_.startsWith( '../' ) ) { path_ = path.join( relativeTo , path_ ) ; }

	// Windows absolute paths
	if ( process.platform === 'win32' && path_.match( /^[A-Z]:\\/ ) ) { return path_ ; }

	if ( isExe && ! path_.includes( '/' ) ) { return path_ ; }

	return path.join( relativeTo , path_ ) ;
} ;



exports.strToPath = str => {
	if ( ! str || typeof str !== 'string' ) { return null ; }
	str = str.toLowerCase() ;
	str = str.replace( /[\s_-]+/g , '-' ) ;
	str = str.replace( /[^a-z0-9-]/g , '' ) ;
	str = str.replace( /-+/g , '-' ) ;
	return str ;
} ;



exports.nameToId = name => {
	if ( ! name || typeof name !== 'string' ) { return null ; }
	var id = string.latinize( name ).toLowerCase() ;
	id = id.replace( /[\s_-]+/g , '-' ) ;
	id = id.replace( /[^a-z0-9+-]/g , '' ) ;
	id = id.replace( /-+/g , '-' ) ;
	return id ;
} ;



exports.configValueCoercion = v => {
	if ( v === null ) { return undefined ; }
	if ( Array.isArray( v ) && ! v.length ) { return undefined ; }
	return v ;
} ;



// Find a file inside a directory with a basename and multiple possible extensions
exports.existsWithBasenameAndExtensions = async ( dirname , basename , extensions , reduce = false ) => {
	var extension , searchPath , newBasename ;

	for ( ;; ) {
		for ( extension of extensions ) {
			searchPath = path.join( dirname , basename + '.' + extension ) ;
			if ( await fsKit.isFile( searchPath ) ) { return searchPath ; }
		}

		// If reduce is on, we will try to remove the last part of the basename
		if ( ! reduce ) { break ; }
		newBasename = basename.replace( /[ ._-]+[^ ._-]+$/ , '' ) ;
		if ( ! newBasename || newBasename === basename ) { break ; }
		basename = newBasename ;
	}

	return null ;
} ;



// Find a file inside a directory with multiple possible extensions
exports.existsWithExtensions = async ( dirname , basename , extensions ) => {
	for ( let extension of extensions ) {
		let searchPattern = path.join( dirname , '*.' + extension ) ;
		try {
			let result = await fsKit.glob( searchPattern ) ;
			if ( result && result[ 0 ] ) { return result[ 0 ] ; }
		}
		catch ( error ) {}
	}

	return null ;
} ;

