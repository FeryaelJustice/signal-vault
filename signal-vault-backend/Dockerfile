# syntax=docker/dockerfile:1

###########
# Build stage: compile and package the Spring Boot fat jar using Gradle + JDK 21.
###########
FROM gradle:8.14-jdk21 AS build
WORKDIR /workspace

# Leverage layer caching: copy build scripts first, then resolve dependencies.
COPY build.gradle settings.gradle ./
COPY gradle ./gradle
# Pre-download dependencies (best-effort; ignored if offline).
RUN gradle --no-daemon dependencies > /dev/null 2>&1 || true

# Copy the rest of the sources and build the jar (skip tests; Testcontainers needs Docker).
COPY src ./src
RUN gradle --no-daemon clean bootJar -x test

###########
# Runtime stage: minimal JRE, non-root user.
###########
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Create a non-root user to run the application.
RUN groupadd --system spring && useradd --system --gid spring --home /app spring

# Copy the built jar from the build stage.
COPY --from=build /workspace/build/libs/*.jar app.jar

USER spring:spring

EXPOSE 8080

# Sensible container-friendly JVM defaults; can be overridden via JAVA_OPTS.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
