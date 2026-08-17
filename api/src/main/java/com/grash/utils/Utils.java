package com.grash.utils;

import com.grash.model.enums.DateFormat;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Random;

@Slf4j
@Component
public class Utils {
    private final Random RANDOM = new SecureRandom();

    public String generateStringId() {
        StringBuilder returnValue = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            String ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            returnValue.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return returnValue.toString();
    }

    public String readFile(String filename) {
        StringBuilder contentBuilder = new StringBuilder();
        try {
            BufferedReader in = new BufferedReader(new FileReader(filename));
            String str;
            while ((str = in.readLine()) != null) {
                contentBuilder.append(str);
            }
            in.close();
        } catch (IOException e) {
            log.error("Failed to read file: {}", filename, e);
        }
        return contentBuilder.toString();
    }

    public String getFormattedDate(Object date, DateFormat dateFormat, String timeZone) {
        if (date == null) return null;
        String pattern = dateFormat == DateFormat.MMDDYY ? "MM/dd/yy HH:mm" : "dd/MM/yy HH:mm";
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern)
                .withZone(ZoneId.of(timeZone));
        if (date instanceof Date) return formatter.format(((Date) date).toInstant());
        if (date instanceof Instant) return formatter.format((Instant) date);
        if (date instanceof LocalDateTime) return formatter.format(((LocalDateTime) date).atZone(ZoneId.of(timeZone)));
        return date.toString();
    }
}
