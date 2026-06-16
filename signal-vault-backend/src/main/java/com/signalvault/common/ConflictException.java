package com.signalvault.common;

/** Thrown when a request conflicts with current state (e.g. email already registered). */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
