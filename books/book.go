package books

import (
	"fmt"
	"io"
	"strings"

	"github.com/dropbox/dropbox-sdk-go-unofficial/dropbox"
	"github.com/dropbox/dropbox-sdk-go-unofficial/dropbox/files"
)

var client files.Client

func SetClient(token string) {
	client = files.New(dropbox.Config{Token: token})
}

type Book struct {
	Name string
	Path string
}

func Get(path string) (books []Book, err error) {
	if client == nil {
		err = fmt.Errorf("client has not been set")
		return
	}

	var res *files.ListFolderResult
	if res, err = client.ListFolder(&files.ListFolderArg{
		Path:  path,
		Limit: 100,
	}); err != nil {
		return
	}

	for {
		for _, item := range res.Entries {
			file, ok := item.(*files.FileMetadata)
			if ok && strings.Contains(file.Name, ".pdf") {
				books = append(books, Book{
					Name: file.Name,
					Path: file.PathLower,
				})
			}
		}

		if res.HasMore {
			if res, err = client.ListFolderContinue(
				&files.ListFolderContinueArg{
					Cursor: res.Cursor,
				}); err != nil {
				return
			}
		} else {
			break
		}
	}

	return
}

func (book Book) Download() (data io.ReadCloser, err error) {
	if client == nil {
		err = fmt.Errorf("client has not been set")
		return
	}

	_, data, err = client.Download(&files.DownloadArg{
		Path: book.Path,
	})

	return
}
