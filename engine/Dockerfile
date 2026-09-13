FROM rust:1.89-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY data ./data
RUN cargo build --locked --release

FROM debian:bookworm-slim AS runtime

RUN useradd --create-home --uid 10001 rawmarket
COPY --from=builder /app/target/release/rawmarket-engine /usr/local/bin/rawmarket-engine

USER rawmarket
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/rawmarket-engine"]
