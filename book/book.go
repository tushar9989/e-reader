package book

type Book struct {
	ID   string
	Name string
}

type History struct {
	Page    int    `json:"page"`
	Version string `json:"version"`
}
