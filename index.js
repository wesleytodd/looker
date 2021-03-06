// Requirements
var fs = require('fs'),
	path = require('path'),
	_ = require('lodash'),
	async = require('async');

// The constructor
var Looker = module.exports = function(options) {

	this.options = _.extend({}, {
		defaultPriority: 500,
		// not implemented
		//skipCache: false
	}, options);

	// The set of lookup paths
	this.lookups = [];

	// Caches
	this._existsCache = {};
	this._requireCache = {};
	this._fileCache = {};

};

// Add a path to the lookup list
Looker.prototype.lookupPath = function(lookupPath, priority) {
	// Default priority
	priority = (typeof priority !== 'number') ? priority : this.options.defaultPriority;

	// Lookup paths should be absolute
	lookupPath = path.resolve(lookupPath);

	// Add the path
	this.lookups.push({
		path: lookupPath,
		priority: priority
	});

	// Keep the list sorted
	this.lookups.sort(function(a, b) {
		return a.priority - b.priority;
	});

	// Invalidate cache
	this._existsCache = {};
	this._requireCache = {};
	this._fileCache = {};

	// Chainable
	return this;
};

// Goes through the lookup list and checks if a file exists
Looker.prototype.exists = function(filename, done) {

	// Check cache
	if (this._existsCache[filename]) {
		// Resolve on next tick
		process.nextTick(function() {
			done(this._existsCache[filename]);
		}.bind(this));
	} else {
		// Async.detect will return the first matched path
		async.detectSeries(this.lookups, function(lookupPath, done) {
			// Join the filename to the path
			var p = path.join(lookupPath.path, filename);

			// Resolve absolute path
			p = path.resolve(p);

			// Call exists on the path
			fs.exists(p, done);
		}, function(result) {
			// If one matched, cache it
			if (result) {
				this._existsCache[filename] = path.join(result.path, filename);
			}

			// Callback with the result
			done(this._existsCache[filename]);
		}.bind(this));
	}

	// Chainable
	return this;
};

// Sync version of exists
Looker.prototype.existsSync = function(filename) {

	// Check cache
	if (this._existsCache[filename]) {
		return this._existsCache[filename];
	} else {
		// The found filepath
		var filepath;

		// Look in each directory
		for (var i in this.lookups) {
			// Create the filepath
			filepath = path.resolve(path.join(this.lookups[i].path, filename));

			// Check if it exists
			if (fs.existsSync(filepath)) {
				// Cache it and break out of loop
				this._existsCache[filename] = filepath;
				break;
			}
		}
		// Return the found path
		return filepath;
	}

};

// Looks for and requires filepaths
Looker.prototype.require = function(filename, done) {

	if (this._requireCache[filename]) {
		// Resolve on next tick
		process.nextTick(function() {
			done(null, this._requireCache[filename].module, this._requireCache[filename].modulePath);
		}.bind(this));
	} else {
		// Find the existing filename
		this.exists(filename, function(filepath) {
			// If a path exists, require it
			if (filepath) {
				try {
					// Require the filepath
					var m = require(filepath);
				} catch(e) {
					return done(e);
				}

				// Save to cache
				this._requireCache[filename] = {
					module: m,
					modulePath: filepath
				};

				// Return with the loaded module
				return done(null, m, filepath);
			}
			
			// File does not exist
			done('Module does not exist');
		}.bind(this));
	}

	// Chainable
	return this;
};

// Looks for and requires filepaths, sync
Looker.prototype.requireSync = function(filename) {

	if (this._requireCache[filename]) {
		// Resolve on next tick
		return this._requireCache[filename].module;
	}

	// Find the proper path
	var filepath = this.existsSync(filename);

	// Return nothing on error
	if (!filepath) return;
	
	// Try to require the file
	try {
		// Require the filepath
		var m = require(filepath);
	} catch(e) {
		return;
	}
	// Save to cache
	this._requireCache[filename] = {
		module: m,
		modulePath: filepath
	};

	// Return with the loaded module
	return m;
};

// Requires every file in a directory, return a map
// of filename to required module
Looker.prototype.requireAll = function(done) {

	// The list to return
	var list = {};
	
	async.eachSeries(this.lookups, function(lookupPath, done) {

		// Confirm that the directory exists
		fs.exists(lookupPath.path, function(exists) {
			// Exit on error
			if (!exists) {
				return done();
			}

			// Read each file from the directory
			fs.readdir(lookupPath.path, function(err, files) {
				// Exit on error
				if (err) {
					return done();
				}

				// For each file, require it
				async.eachSeries(files, function(f, done) {
					this.require(f, function(err, module) {
						// Exit on error
						if (err) {
							return done();
						}

						// Add to list
						list[f] = module;

						// Callback 
						done();
					});
				}.bind(this), done);

			}.bind(this));
			
		}.bind(this));
		
	}.bind(this), function() {

		// Complete with the list of modules required
		done(list);
		
	});

	// Chainable
	return this;
};

// Reads a file from the load paths
Looker.prototype.readFile = function(filename, done) {

	if (this._fileCache[filename]) {
		// Resolve on next tick
		process.nextTick(function() {
			done(null, this._fileCache[filename].content, this._fileCache[filename].filepath);
		}.bind(this));
	} else {
		// Find the file that exists
		this.exists(filename, function(filepath) {
			// Exit on error
			if (!filepath) {
				return done('Cannot fine file: ' + filename);
			}

			// Read the file content
			fs.readFile(filepath, {encoding: 'utf8'}, function(err, content) {
				// Exit on error
				if (err) {
					return done(err);
				}

				// Save to cache
				this._fileCache[filename] = {
					content: content,
					filepath: filepath
				};

				// Return with content
				done(null, content, filepath);
				
			}.bind(this));
			
		}.bind(this));
	}

	// Chainable
	return this;
};

// Sync version of readFile
Looker.prototype.readFileSync = function(filename) {

	// Check in cache
	if (this._fileCache[filename]) {
		return this._fileCache[filename].content;
	}

	var filepath = this.existsSync(filename);

	// if the file exists
	if (filepath) {
		// Read the file
		var content = fs.readFileSync(filepath, {encoding: 'utf8'});
		
		// Cache the file
		this._fileCache[filename] = {
			content: content,
			filepath: filepath
		};

		// Return the content
		return content;
	}

};

// Try a list of file names in each path
Looker.prototype.tryFiles = function(files, done) {
	// The found file and it's content
	var content, filepath;

	// Wrok through each file
	async.detectSeries(files, function(file, done) {
		this.readFile(file, function(err, c, f) {
			// If found, save the content and path
			if (!err) {
				content = c;
				filepath = f;
				done(true);
			} else {
				done(false);
			}
		});
	}.bind(this), function(file) {
		// Complete with the content and filepath
		done(content, filepath);
	});

	// Chainable
	return this;
};
