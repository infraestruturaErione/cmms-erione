package com.grash.service;

import org.junit.jupiter.api.Test;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Iterator;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PdfImageOptimizerTest {
    private final PdfImageOptimizer optimizer = new PdfImageOptimizer();

    @Test
    void largeLandscapeIsReducedTo1920x1440() throws Exception {
        byte[] input = jpeg(4032, 3024, false);

        PdfImageOptimizer.Result result = optimizer.optimize(input);

        assertTrue(result.successful());
        assertTrue(result.optimized());
        assertEquals(1920, result.outputWidth());
        assertEquals(1440, result.outputHeight());
        assertEquals("image/jpeg", result.mimeType());
        assertImageDimensions(result.bytes(), 1920, 1440);
    }

    @Test
    void largePortraitIsReducedTo1440x1920() throws Exception {
        PdfImageOptimizer.Result result = optimizer.optimize(jpeg(3024, 4032, false));

        assertTrue(result.successful());
        assertEquals(1440, result.outputWidth());
        assertEquals(1920, result.outputHeight());
        assertEquals(0.75, (double) result.outputWidth() / result.outputHeight(), 0.001);
        assertImageDimensions(result.bytes(), 1440, 1920);
    }

    @Test
    void smallImageIsNotUpscaledOrRecompressed() throws Exception {
        byte[] input = jpeg(1280, 960, false);

        PdfImageOptimizer.Result result = optimizer.optimize(input);

        assertTrue(result.successful());
        assertFalse(result.optimized());
        assertEquals(1280, result.outputWidth());
        assertEquals(960, result.outputHeight());
        assertArrayEquals(input, result.bytes());
    }

    @Test
    void optimizedJpegIsSignificantlySmallerThanLargeDetailedInput() throws Exception {
        byte[] input = noisyJpeg(2400, 1800);

        PdfImageOptimizer.Result result = optimizer.optimize(input);

        assertTrue(result.successful());
        assertTrue(result.bytes().length < input.length,
                () -> "Expected optimized image smaller than " + input.length + " bytes, got " + result.bytes().length);
    }

    @Test
    void transparentPngKeepsAlphaInsteadOfTurningBlack() throws Exception {
        BufferedImage image = new BufferedImage(2400, 1200, BufferedImage.TYPE_INT_ARGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(0, 0, 0, 0));
        graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
        graphics.setColor(new Color(220, 20, 60, 180));
        graphics.fillRect(600, 300, 1200, 600);
        graphics.dispose();
        byte[] input = png(image);
        image.flush();

        PdfImageOptimizer.Result result = optimizer.optimize(input);
        BufferedImage output = ImageIO.read(new ByteArrayInputStream(result.bytes()));

        assertTrue(result.successful());
        assertEquals("image/png", result.mimeType());
        assertTrue(output.getColorModel().hasAlpha());
        assertEquals(0, (output.getRGB(0, 0) >>> 24) & 0xff);
        assertTrue(((output.getRGB(output.getWidth() / 2, output.getHeight() / 2) >>> 24) & 0xff) > 0);
        output.flush();
    }

    @Test
    void exifOrientationIsAppliedBeforeSizing() throws Exception {
        byte[] landscape = jpeg(2400, 1200, false);
        byte[] orientedPortrait = injectExifOrientation(landscape, 6);

        PdfImageOptimizer.Result result = optimizer.optimize(orientedPortrait);

        assertTrue(result.successful());
        assertEquals(960, result.outputWidth());
        assertEquals(1920, result.outputHeight());
        assertImageDimensions(result.bytes(), 960, 1920);
    }

    @Test
    void corruptImageReturnsSafeFailureWithoutOriginalBytes() {
        byte[] corrupt = "not-an-image".getBytes();

        PdfImageOptimizer.Result result = optimizer.optimize(corrupt);

        assertFalse(result.successful());
        assertNull(result.bytes());
        assertNotNull(result.failureReason());
        assertEquals(corrupt.length, result.originalSize());
    }

    @Test
    void gifAndBmpAreDecodedAndNormalizedForPdfCompatibility() throws Exception {
        for (String format : new String[]{"gif", "bmp"}) {
            byte[] input = imageBytes(640, 360, format);

            PdfImageOptimizer.Result result = optimizer.optimize(input);

            assertTrue(result.successful(), () -> "Expected support for " + format);
            assertTrue(result.optimized());
            assertEquals("image/jpeg", result.mimeType());
            assertImageDimensions(result.bytes(), 640, 360);
        }
    }

    @Test
    void webpIsDecodedAndNormalizedForPdfCompatibility() throws Exception {
        byte[] input = Base64.getDecoder().decode(
                "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==");

        PdfImageOptimizer.Result result = optimizer.optimize(input);

        assertTrue(result.successful(), result.failureReason());
        assertTrue(result.optimized());
        assertTrue(result.mimeType().equals("image/jpeg") || result.mimeType().equals("image/png"));
        assertImageDimensions(result.bytes(), 1, 1);
    }

    private static byte[] jpeg(int width, int height, boolean noisy) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        if (noisy) {
            Random random = new Random(42);
            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    image.setRGB(x, y, random.nextInt(0x1000000));
                }
            }
        } else {
            Graphics2D graphics = image.createGraphics();
            graphics.setColor(new Color(28, 74, 122));
            graphics.fillRect(0, 0, width, height);
            graphics.setColor(new Color(238, 242, 247));
            graphics.fillOval(width / 5, height / 5, width * 3 / 5, height * 3 / 5);
            graphics.dispose();
        }
        byte[] result = writeJpeg(image, noisy ? 1.0f : 0.9f);
        image.flush();
        return result;
    }

    private static byte[] noisyJpeg(int width, int height) throws Exception {
        return jpeg(width, height, true);
    }

    private static byte[] writeJpeg(BufferedImage image, float quality) throws Exception {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(quality);
            writer.write(null, new IIOImage(image, null, null), params);
            imageOutput.flush();
            return output.toByteArray();
        } finally {
            writer.dispose();
        }
    }

    private static byte[] png(BufferedImage image) throws Exception {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        }
    }

    private static byte[] imageBytes(int width, int height, String format) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = image.createGraphics();
        graphics.setColor(new Color(12, 86, 145));
        graphics.fillRect(0, 0, width, height);
        graphics.setColor(Color.WHITE);
        graphics.fillRect(width / 4, height / 4, width / 2, height / 2);
        graphics.dispose();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            assertTrue(ImageIO.write(image, format, output), () -> "Missing writer for " + format);
            return output.toByteArray();
        } finally {
            image.flush();
        }
    }

    private static void assertImageDimensions(byte[] bytes, int width, int height) throws Exception {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
        assertNotNull(image);
        assertEquals(width, image.getWidth());
        assertEquals(height, image.getHeight());
        image.flush();
    }

    private static byte[] injectExifOrientation(byte[] jpeg, int orientation) {
        byte[] exif = new byte[]{
                'E', 'x', 'i', 'f', 0, 0,
                'I', 'I', 42, 0, 8, 0, 0, 0,
                1, 0,
                0x12, 0x01, 3, 0, 1, 0, 0, 0, (byte) orientation, 0, 0, 0,
                0, 0, 0, 0
        };
        int segmentLength = exif.length + 2;
        byte[] result = new byte[jpeg.length + exif.length + 4];
        result[0] = jpeg[0];
        result[1] = jpeg[1];
        result[2] = (byte) 0xff;
        result[3] = (byte) 0xe1;
        result[4] = (byte) (segmentLength >>> 8);
        result[5] = (byte) segmentLength;
        System.arraycopy(exif, 0, result, 6, exif.length);
        System.arraycopy(jpeg, 2, result, exif.length + 6, jpeg.length - 2);
        return result;
    }
}
