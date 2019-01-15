package book

type Book struct {
	ID    string
	Name  string
	IsPDF bool
}

type History struct {
	Data    string `json:"data"`
	Version string `json:"version"`
}
