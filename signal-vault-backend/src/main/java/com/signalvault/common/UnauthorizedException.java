package com.signalvault.common;

/** Thrown when credentials or tokens are invalid. */
public class UnauthorizedException extends RuntimeException {

    public UnauthorizedException(String message) {
        super(message);
    }
}
