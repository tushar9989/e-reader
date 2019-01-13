package book

import (
	"io"
)

type Repository interface {
	List(path string) (books []Book, err error)
	Download(path string) (book Book, data io.ReadCloser, err error)
	GetHistory(ID string) (page int, err error)
	UpdateHistory(ID string, page int) (err error)
}
