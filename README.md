node-svnpubsub
==============

Node-svnpubsub is a utility for keeping remote servers up-to-date on changes to
an subversion repository.


## Usage

### Post-commit hook setup

Run `commit-hook.js $REPOS $REV` from your post-commit hook.  If you're using a
version of svn that calls the commit hooks in the same manner, you can also
symlink `commit-hook.js` as `hooks/post-commit`.

The script looks for a config file in `conf/hooks.json`.  It consists of one or
more objects keyed by path prefixes to look for when deciding if a commit is
published to listening servers.  Each prefix requires the IP/hostname of the
remote server; the port is optional and defaults to 2069.

Sample file:
```json
{
	"trunk/": {
		"host": "192.168.31.41",
		"port": "12345"
	},
	"branches/twig/": {
		"host": "otherserver.lan",
	}
}
```

----------------------------

### Listening server setup

Run `svnsub.js`.  This creates a TCP server that listens on the port specified
as the only argument, or 2069 by default.  It looks for `config.json` in the
same directory it's run from.  The config is an object keyed by each repository
the client will recognize.  Each repository requires the following options:
* __prefix__: Folder path prefix to strip from affected files when exporting.
* __localPath__: Path where files should be exported to.
* __repoPath__: The script determines the repo host from the incoming
  connection, this indicates where on the server to look for the repo.
* __repoPort__: Port to use for the svn server when not 80.
* __svnuser__: SVN user to connect as.
* __svnpass__: SVN password for specified user.

Sample file:
```json
{
	"repo1": {
		"prefix": "trunk/",
		"localPath" : "/path/to/export/",
		"repoPath"	: "repo1",
		"svnuser"	 : "me",
		"svnpass"	 : "123"
	},
	"repo2": {
		"prefix": "branches/twig/",
		"localPath": "/path/to/branch/export/",
		"repoPath": "twig",
		"repoPort": "8080",
		"svnuser": "me",
		"svnpass": "123"
	}
}
```
