package history

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"sync"
	"time"

	"github.com/geek1011/BookBrowser/dropbox"
)

type History struct {
	pageMap     map[string]int
	mut         sync.Mutex
	dbx         dropbox.Dropbox
	path        string
	needsBackup bool
}

func New(dbx dropbox.Dropbox, path string) (history *History) {
	history = new(History)
	history.dbx = dbx
	history.path = path
	go history.periodicBackup()

	if err := history.load(); err != nil {
		log.Printf("load from dropbox failed. %s", err.Error())
		history.pageMap = make(map[string]int)
	}

	return
}

func (history *History) load() (err error) {
	var reader io.ReadCloser
	if reader, err = history.dbx.Download(history.path); err != nil {
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

func (history *History) periodicBackup() {
	ticker := time.NewTicker(10 * time.Minute)
	for range ticker.C {
		history.mut.Lock()
		if history.needsBackup {
			fmt.Println(history.pageMap)
			data, err := json.Marshal(history.pageMap)
			history.needsBackup = false
			history.mut.Unlock()
			if err != nil {
				log.Printf("writing to dropbox failed. reason: %s", err.Error())
				continue
			}

			_, err = history.dbx.Upload(history.path, bytes.NewReader(data))
			if err != nil {
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

func (history *History) Get(name string) int {
	history.mut.Lock()
	defer history.mut.Unlock()
	if page, ok := history.pageMap[name]; ok {
		return page
	}

	return 1
}

func (history *History) Set(name string, page int) {
	history.mut.Lock()
	defer history.mut.Unlock()
	history.needsBackup = true
	history.pageMap[name] = page
	log.Printf("Updated page for %s to %d", name, page)
}
