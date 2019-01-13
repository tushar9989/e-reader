package book

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"strconv"
	"strings"
	"sync"

	dbx "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox"
	dropbox "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox/files"
)

type DropboxRepository struct {
	client        dropbox.Client
	cache         map[string]historyItem
	historyPrefix string
	mux           sync.Mutex
}

func NewDropboxRepository(
	token string, historyPrefix string,
) (repo *DropboxRepository) {
	repo = new(DropboxRepository)
	repo.cache = make(map[string]historyItem)
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

			if strings.Contains(meta.Name, ".pdf") {
				books = append(books, DropboxBook{
					id:   meta.Id,
					name: meta.Name,
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

	book = DropboxBook{
		id:   meta.Id,
		name: meta.Name,
	}

	return
}

func (repo *DropboxRepository) GetHistory(ID string) (page int, err error) {
	repo.mux.Lock()
	defer repo.mux.Unlock()
	item, ok := repo.cache[ID]
	if !ok {
		func() {
			var data io.ReadCloser
			if item.meta, data, err = repo.client.Download(&dropbox.DownloadArg{
				Path: fmt.Sprintf("%s/%s", repo.historyPrefix, ID),
			}); err != nil {
				return
			}

			defer data.Close()

			var pageStr string
			if pageStr, err = bufio.NewReader(data).ReadString('\n'); err != nil {
				return
			}

			if item.page, err = strconv.Atoi(pageStr); err != nil {
				return
			}

			repo.cache[ID] = item
		}()

		if err != nil {
			log.Printf("could not load old data for %s, err: %v", ID, err)
			item.page = 1
			err = nil
		}
	}

	page = item.page
	return
}

func (repo *DropboxRepository) UpdateHistory(ID string, page int) (err error) {
	repo.mux.Lock()
	defer repo.mux.Unlock()
	item, ok := repo.cache[ID]

	var mode *dropbox.WriteMode
	if !ok {
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
			Update: item.meta.Rev,
		}
	}

	if item.meta, err = repo.upload(
		ID,
		strings.NewReader(fmt.Sprintf("%d\n", page)),
		mode,
	); err != nil {
		return
	}

	item.page = page
	repo.cache[ID] = item
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
