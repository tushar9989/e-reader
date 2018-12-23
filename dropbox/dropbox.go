package dropbox

import (
	"io"

	dropbox "github.com/tj/go-dropbox"
)

type Dropbox struct {
	client *dropbox.Client
}

func New(token string) (d Dropbox) {
	d.client = dropbox.New(dropbox.NewConfig(token))
	return
}

func (d Dropbox) Get(path string) (list []dropbox.Metadata, err error) {
	var res *dropbox.ListFolderOutput
	if res, err = d.client.Files.ListFolder(&dropbox.ListFolderInput{
		Path: path,
	}); err != nil {
		return
	}

	for {
		for _, item := range res.Entries {
			list = append(list, *item)
		}

		if res.HasMore {
			if res, err = d.client.Files.ListFolderContinue(
				&dropbox.ListFolderContinueInput{
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
	data io.ReadCloser, err error,
) {
	var out *dropbox.DownloadOutput
	if out, err = d.client.Files.Download(&dropbox.DownloadInput{
		Path: path,
	}); err != nil {
		return
	}

	data = out.Body
	return
}

func (d Dropbox) Upload(
	path string, data io.Reader,
) (meta dropbox.Metadata, err error) {
	out, err := d.client.Files.Upload(&dropbox.UploadInput{
		Mute:   true,
		Mode:   dropbox.WriteModeOverwrite,
		Path:   path,
		Reader: data,
	})
	if err != nil {
		return
	}

	meta = out.Metadata
	return
}
