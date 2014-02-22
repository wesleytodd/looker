# Looker

A utility library to help finding and loading files or modules.  Give `looker` a set of paths to look in, and then call one of `looker`'s methods to find and load the file.  Paths can be specified with a priority, so you can specify a cascading set of places to look and only load the first matching result.  This library can also be used to `require` in javascript files into a node app.

## Examples

```javascript
// Create a new looker
var look = new require('looker')();

// Add some lookup paths
look.lookupPath('.');
look.lookupPath('..');

// A lookup path to look in first,
// The default priority is 500, so
// any path with a lower priority value
// will be looked in first.  This will
// look two directories up before
// looking in the next two
look.lookupPath('../..', 100);

// Check if a file exists
look.exists('package.json', function(fullPath) {
	// The full path to the resolved package.json
	// Ex: /Users/you/your-project/package.json
	if (fullPath) {
		console.log('Yeah, found it: ' + fullPath);
	} else {
		console.error('Could not fine file');
	}
});

// Read a file content
look.readFile('package.json', function(err, content, fullPath) {
	// Check for errors
	if (err) {
		console.error('Either the file was not found or is not readable');
		return;
	}

	// Use the content
	var pkg = JSON.parse(content);
	console.log('Version: ' + pkg.version);
});

// Require a file
look.require('index.js', function(err, module, fullPath) {
	// Check for errors
	if (err) {
		console.error('Either it did not exist, or failed to be required');
		return;
	}
	
	// Use the module
	module.someFunc();
});

// Require a module, sync
var m = look.requireSync('index.js');
if (!m) {
	// Module not found
} else {
	// Do something with the module
}

// Require all files the directores
look.requireAll(function(modules) {

	// Modules is a hash of resolved paths to 
	// the required content of the module:
	// {
	//   '/full/path/to/file.js': [Function]
	//   '/full/path/file.js': [Function]
	// }
	
});

// Try for a file name in each lookup path
look.tryFiles([
	'home.html',
	'index.html'
], function(content, filepath) {
	
	// Looks for the first file, home.html, in each path, 
	// if it was not found, it moves on to index.html
	// The content and filepath returned are the first
	// file found that matched the filemname

});
```
