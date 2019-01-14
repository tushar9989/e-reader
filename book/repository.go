package book

import (
	"io"
)

type Repository interface {
	List(path string) (books []Book, err error)
	Download(path string) (book Book, data io.ReadCloser, err error)
	GetHistory(ID string) (history History, err error)
	WriteHistory(ID string, history History) (updated History, err error)
}
