package book

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"strings"

	dbx "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox"
	dropbox "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox/files"
)

type DropboxRepository struct {
	client        dropbox.Client
	historyPrefix string
}

func NewDropboxRepository(
	token string, historyPrefix string,
) (repo *DropboxRepository) {
	repo = new(DropboxRepository)
	repo.client = dropbox.New(dbx.Config{
		Token: token,
	})

	repo.historyPrefix = historyPrefix
	if repo.historyPrefix == "" {
		repo.historyPrefix = "/history"
	}

	return
}

func (repo *DropboxRepository) List(path string) (books []Book, err error) {
	var res *dropbox.ListFolderResult
	if res, err = repo.client.ListFolder(&dropbox.ListFolderArg{
		Path: path,
	}); err != nil {
		return
	}

	for {
		for _, item := range res.Entries {
			meta, ok := item.(*dropbox.FileMetadata)
			if !ok {
				continue
			}

			if strings.Contains(meta.Name, ".pdf") || strings.Contains(meta.Name, ".epub") {
				books = append(books, Book{
					ID:    meta.Id,
					Name:  meta.Name,
					IsPDF: strings.Contains(meta.Name, ".pdf"),
				})
			}
		}

		if !res.HasMore {
			break
		}

		if res, err = repo.client.ListFolderContinue(
			&dropbox.ListFolderContinueArg{
				Cursor: res.Cursor,
			}); err != nil {
			return
		}
	}

	return
}

func (repo *DropboxRepository) Download(path string) (
	book Book, data io.ReadCloser, err error,
) {
	var meta *dropbox.FileMetadata
	if meta, data, err = repo.client.Download(&dropbox.DownloadArg{
		Path: path,
	}); err != nil {
		return
	}

	book = Book{
		ID:   meta.Id,
		Name: meta.Name,
	}

	return
}

func (repo *DropboxRepository) GetHistory(ID string) (history History, err error) {
	if err = func() (err error) {
		var (
			data io.ReadCloser
			meta *dropbox.FileMetadata
		)
		if meta, data, err = repo.client.Download(&dropbox.DownloadArg{
			Path: fmt.Sprintf("%s/%s", repo.historyPrefix, ID),
		}); err != nil {
			return
		}

		defer data.Close()

		buf := new(bytes.Buffer)
		buf.ReadFrom(data)
		history.Data = buf.String()
		history.Version = meta.Rev
		return
	}(); err != nil {
		log.Printf("could not load old data for %s, err: %v", ID, err)
		err = nil
	}

	return
}

func (repo *DropboxRepository) WriteHistory(
	ID string, history History,
) (updated History, err error) {
	var mode *dropbox.WriteMode
	if history.Version == "" {
		mode = &dropbox.WriteMode{
			Tagged: dbx.Tagged{
				Tag: dropbox.WriteModeAdd,
			},
		}
	} else {
		mode = &dropbox.WriteMode{
			Tagged: dbx.Tagged{
				Tag: dropbox.WriteModeUpdate,
			},
			Update: history.Version,
		}
	}

	var meta *dropbox.FileMetadata
	if meta, err = repo.upload(
		ID,
		strings.NewReader(history.Data),
		mode,
	); err != nil {
		return
	}

	updated.Data = history.Data
	updated.Version = meta.Rev
	return
}

func (repo *DropboxRepository) upload(
	ID string, data io.Reader, mode *dropbox.WriteMode,
) (meta *dropbox.FileMetadata, err error) {
	meta, err = repo.client.Upload(&dropbox.CommitInfo{
		Mute:           true,
		StrictConflict: true,
		Mode:           mode,
		Path:           fmt.Sprintf("%s/%s", repo.historyPrefix, ID),
	}, data)

	return
}
