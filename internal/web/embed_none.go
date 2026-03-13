//go:build !embed

package web

import (
	"io/fs"
	"os"
)

func publicFS() fs.FS {
	return os.DirFS("internal/web/embed/public")
}
