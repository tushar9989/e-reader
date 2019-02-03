FROM golang:alpine
WORKDIR /go/src/github.com/tushar9989/e-reader
COPY . .
RUN go build
ENTRYPOINT ["/go/src/github.com/tushar9989/e-reader/e-reader"]
