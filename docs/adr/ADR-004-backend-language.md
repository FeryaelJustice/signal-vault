# ADR-004 — Backend language: Java + Spring Boot

- **Status**: Accepted
- **Date**: 2026-06-16

## Context

The product spec specifies Java + Spring Boot. The author is also strong in Kotlin (Android),
so Kotlin + Spring was a credible alternative for a full-Kotlin stack.

## Decision

Keep **Java + Spring Boot** for the backend, targeting the **Java 21 LTS** toolchain.

## Rationale

- Matches the written spec and the most common enterprise Spring posture.
- Java 21 (records, pattern matching, virtual threads) keeps the code modern and concise.

## Consequences

- The host machine only has JDK 26 installed, which current Gradle/Spring may not fully
  support as a *runtime*. Therefore builds and verification run through a **Docker
  multi-stage image pinned to JDK 21**, which is also the deployment artifact. Local
  `./gradlew` is best-effort; CI (Linux + JDK 21) is the authoritative build.
- Revisiting Kotlin later is low-cost (same framework, same contract).
