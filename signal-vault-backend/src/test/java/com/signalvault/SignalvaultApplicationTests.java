package com.signalvault;

import com.signalvault.integration.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;

/**
 * Smoke test: verifies the full application context boots against a real PostgreSQL
 * (provided by Testcontainers) with Flyway migrations applied. Requires Docker on the host.
 */
class SignalvaultApplicationTests extends AbstractIntegrationTest {

    @Test
    void contextLoads() {
    }
}
