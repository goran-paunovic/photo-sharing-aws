package com.example.photos.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class AwsConfig {
    @Bean
    Region awsRegion(@Value("${app.aws.region}") String region) {
        return Region.of(region);
    }

    @Bean
    S3Client s3Client(Region region) {
        return S3Client.builder().region(region).build();
    }

    @Bean
    S3Presigner s3Presigner(Region region) {
        return S3Presigner.builder().region(region).build();
    }

    @Bean
    DynamoDbClient dynamoDbClient(Region region) {
        return DynamoDbClient.builder().region(region).build();
    }
}
