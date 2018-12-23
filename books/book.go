package books

import (
	"strings"

	"github.com/geek1011/BookBrowser/dropbox"
)

type Book struct {
	Name string
	Path string
	Page int
}

func Load(path string, dbx dropbox.Dropbox) (books []Book, err error) {
	files, err := dbx.Get(path)
	if err != nil {
		return
	}

	for _, file := range files {
		if strings.Contains(file.Name, ".pdf") {
			books = append(books, Book{
				Name: file.Name,
				Path: file.PathLower,
				Page: 1,
			})
		}
	}

	return
}
