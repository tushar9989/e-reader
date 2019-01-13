package book

import (
	"github.com/dropbox/dropbox-sdk-go-unofficial/dropbox/files"
)

type Book interface {
	ID() string
	Name() string
}

type DropboxBook struct {
	id   string
	name string
}

func (book DropboxBook) ID() string {
	return book.id
}

func (book DropboxBook) Name() string {
	return book.name
}

type historyItem struct {
	meta *files.FileMetadata
	page int
}
