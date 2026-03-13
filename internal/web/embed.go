//go:build embed

package web

import (
	"embed"
	"io/fs"
)

//go:embed embed/public
var embeddedFiles embed.FS

func publicFS() fs.FS {
	sub, err := fs.Sub(embeddedFiles, "embed/public")
	if err != nil {
		panic(err)
	}

	return sub
}
