package com.signalvault.common;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI signalVaultOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("SignalVault API")
                        .description("Secure notes and realtime private messages. "
                                + "The server stores client-side ciphertext only and never sees plaintext.")
                        .version("v1")
                        .license(new License().name("MIT")))
                .components(new Components()
                        .addSecuritySchemes("bearerAuth", new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")));
    }
}
