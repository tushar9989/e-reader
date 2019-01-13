package dropbox

import (
	"io"

	dbx "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox"
	dropbox "github.com/dropbox/dropbox-sdk-go-unofficial/dropbox/files"
)

type Dropbox struct {
	client dropbox.Client
}

func New(token string) (d Dropbox) {
	d.client = dropbox.New(dbx.Config{
		Token: token,
	})

	return
}

func (d Dropbox) Get(path string) (list []*dropbox.FileMetadata, err error) {
	var res *dropbox.ListFolderResult
	if res, err = d.client.ListFolder(&dropbox.ListFolderArg{
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

			list = append(list, meta)
		}

		if res.HasMore {
			if res, err = d.client.ListFolderContinue(
				&dropbox.ListFolderContinueArg{
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

func (d Dropbox) Download(path string) (
	res *dropbox.FileMetadata, data io.ReadCloser, err error,
) {
	if res, data, err = d.client.Download(&dropbox.DownloadArg{
		Path: path,
	}); err != nil {
		return
	}

	return
}

func (d Dropbox) Upload(
	path string, rev string, data io.Reader,
) (meta *dropbox.FileMetadata, err error) {
	if meta, err = d.client.Upload(&dropbox.CommitInfo{
		Mute:           true,
		StrictConflict: true,
		Mode: &dropbox.WriteMode{
			Tagged: dbx.Tagged{
				Tag: dropbox.WriteModeUpdate,
			},
			Update: rev,
		},
		Path: path,
	}, data); err != nil {
		return
	}

	return
}
