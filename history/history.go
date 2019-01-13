package history

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"sync"
	"time"

	dbx "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox/files"
	"github.com/geek1011/BookBrowser/dropbox"
)

type History struct {
	pageMap     map[string]int
	mut         sync.Mutex
	dbx         dropbox.Dropbox
	meta        *dbx.FileMetadata
	needsBackup bool
}

func New(dbx dropbox.Dropbox, path string) (history *History) {
	history = new(History)
	history.dbx = dbx
	go history.periodicBackup()

	if err := history.load(path); err != nil {
		log.Printf("load from dropbox failed. %s", err.Error())
		history.pageMap = make(map[string]int)
	}

	return
}

func (history *History) load(path string) (err error) {
	var reader io.ReadCloser
	if history.meta, reader, err = history.dbx.Download(path); err != nil {
		return
	}
	defer reader.Close()

	var data []byte
	if data, err = ioutil.ReadAll(reader); err != nil {
		return
	}

	if err = json.Unmarshal(data, &history.pageMap); err != nil {
		return
	}

	return
}

// TODO: add a repo with an interface
// and then make dropbox repo that backs up locally and on dropbox
func (history *History) periodicBackup() {
	ticker := time.NewTicker(30 * time.Second)
	for range ticker.C {
		history.mut.Lock()
		if history.needsBackup {
			data, err := json.Marshal(history.pageMap)
			history.needsBackup = false
			history.mut.Unlock()
			if err != nil {
				log.Printf("writing to dropbox failed. reason: %s", err.Error())
				continue
			}

			if history.meta, err = history.dbx.Upload(
				history.meta.PathLower, history.meta.Rev, bytes.NewReader(data),
			); err != nil {
				log.Printf("writing to dropbox failed. reason: %v", err)
				continue
			}

			log.Println("backed up history to dropbox")
		} else {
			history.mut.Unlock()
			log.Println("history in dropbox already up to date")
		}
	}
}

func (history *History) Get(id string) int {
	history.mut.Lock()
	defer history.mut.Unlock()
	if page, ok := history.pageMap[id]; ok {
		return page
	}

	return 1
}

func (history *History) Set(id string, page int) {
	history.mut.Lock()
	defer history.mut.Unlock()
	history.needsBackup = true
	history.pageMap[id] = page
	log.Printf("Updated page for %s to %d", id, page)
}
