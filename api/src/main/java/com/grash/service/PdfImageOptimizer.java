package com.grash.service;

import com.drew.imaging.ImageMetadataReader;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifIFD0Directory;
import org.springframework.stereotype.Component;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Iterator;
import java.util.Locale;

@Component
public class PdfImageOptimizer {
    static final int MAX_IMAGE_DIMENSION = 1920;
    static final float JPEG_QUALITY = 0.82f;

    static {
        ImageIO.scanForPlugins();
    }

    public Result optimize(byte[] sourceBytes) {
        if (sourceBytes == null || sourceBytes.length == 0) {
            return Result.failure(sourceBytes == null ? 0 : sourceBytes.length, "empty image");
        }

        ImageReader reader = null;
        BufferedImage decoded = null;
        BufferedImage oriented = null;
        BufferedImage resized = null;
        int sourceWidth = 0;
        int sourceHeight = 0;
        String sourceFormat = "unknown";

        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(sourceBytes))) {
            if (input == null) {
                return Result.failure(sourceBytes.length, "ImageIO could not open the image stream");
            }

            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) {
                return Result.failure(sourceBytes.length, "unsupported or corrupt image format");
            }

            reader = readers.next();
            sourceFormat = reader.getFormatName();
            reader.setInput(input, true, true);
            sourceWidth = reader.getWidth(0);
            sourceHeight = reader.getHeight(0);
            int orientation = readExifOrientation(sourceBytes);
            int orientedWidth = swapsDimensions(orientation) ? sourceHeight : sourceWidth;
            int orientedHeight = swapsDimensions(orientation) ? sourceWidth : sourceHeight;
            String sourceMimeType = mimeTypeFor(sourceFormat);

            if (orientation == 1 && Math.max(orientedWidth, orientedHeight) <= MAX_IMAGE_DIMENSION
                    && canReuseWithoutTranscoding(sourceFormat)) {
                return Result.success(sourceBytes, sourceMimeType, sourceBytes.length, sourceWidth, sourceHeight,
                        orientedWidth, orientedHeight, false);
            }

            ImageReadParam readParam = reader.getDefaultReadParam();
            int subsampling = Math.max(1, Math.max(sourceWidth, sourceHeight) / MAX_IMAGE_DIMENSION);
            if (subsampling > 1) {
                readParam.setSourceSubsampling(subsampling, subsampling, 0, 0);
            }
            decoded = reader.read(0, readParam);
            if (decoded == null) {
                return Result.failure(sourceBytes.length, sourceFormat, sourceWidth, sourceHeight,
                        "decoder returned no image");
            }

            oriented = applyExifOrientation(decoded, orientation);
            int[] targetSize = fitWithin(oriented.getWidth(), oriented.getHeight(), MAX_IMAGE_DIMENSION);
            resized = resize(oriented, targetSize[0], targetSize[1]);
            boolean hasAlpha = resized.getColorModel().hasAlpha();
            byte[] outputBytes = hasAlpha ? encodePng(resized) : encodeJpeg(resized);
            String outputMimeType = hasAlpha ? "image/png" : "image/jpeg";

            return Result.success(outputBytes, outputMimeType, sourceBytes.length, sourceWidth, sourceHeight,
                    resized.getWidth(), resized.getHeight(), true);
        } catch (Exception e) {
            String message = e.getMessage() == null ? e.getClass().getSimpleName()
                    : e.getClass().getSimpleName() + ": " + e.getMessage();
            return Result.failure(sourceBytes.length, sourceFormat, sourceWidth, sourceHeight, message);
        } finally {
            if (reader != null) {
                reader.dispose();
            }
            flushDistinct(resized, oriented, decoded);
        }
    }

    private static int readExifOrientation(byte[] sourceBytes) {
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(new ByteArrayInputStream(sourceBytes));
            ExifIFD0Directory directory = metadata.getFirstDirectoryOfType(ExifIFD0Directory.class);
            if (directory != null && directory.containsTag(ExifIFD0Directory.TAG_ORIENTATION)) {
                int orientation = directory.getInt(ExifIFD0Directory.TAG_ORIENTATION);
                return orientation >= 1 && orientation <= 8 ? orientation : 1;
            }
        } catch (Exception ignored) {
            // Missing or malformed EXIF must not prevent normal image decoding.
        }
        return 1;
    }

    private static boolean swapsDimensions(int orientation) {
        return orientation >= 5 && orientation <= 8;
    }

    static BufferedImage applyExifOrientation(BufferedImage source, int orientation) {
        if (orientation <= 1 || orientation > 8) {
            return source;
        }

        int sourceWidth = source.getWidth();
        int sourceHeight = source.getHeight();
        int targetWidth = swapsDimensions(orientation) ? sourceHeight : sourceWidth;
        int targetHeight = swapsDimensions(orientation) ? sourceWidth : sourceHeight;
        BufferedImage target = new BufferedImage(targetWidth, targetHeight,
                source.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);

        for (int y = 0; y < sourceHeight; y++) {
            for (int x = 0; x < sourceWidth; x++) {
                int targetX;
                int targetY;
                switch (orientation) {
                    case 2 -> { targetX = sourceWidth - 1 - x; targetY = y; }
                    case 3 -> { targetX = sourceWidth - 1 - x; targetY = sourceHeight - 1 - y; }
                    case 4 -> { targetX = x; targetY = sourceHeight - 1 - y; }
                    case 5 -> { targetX = y; targetY = x; }
                    case 6 -> { targetX = sourceHeight - 1 - y; targetY = x; }
                    case 7 -> { targetX = sourceHeight - 1 - y; targetY = sourceWidth - 1 - x; }
                    case 8 -> { targetX = y; targetY = sourceWidth - 1 - x; }
                    default -> { targetX = x; targetY = y; }
                }
                target.setRGB(targetX, targetY, source.getRGB(x, y));
            }
        }
        return target;
    }

    private static int[] fitWithin(int width, int height, int maxDimension) {
        double scale = Math.min(1.0, (double) maxDimension / Math.max(width, height));
        return new int[]{Math.max(1, (int) Math.round(width * scale)),
                Math.max(1, (int) Math.round(height * scale))};
    }

    private static BufferedImage resize(BufferedImage source, int width, int height) {
        if (source.getWidth() == width && source.getHeight() == height) {
            return source;
        }
        boolean hasAlpha = source.getColorModel().hasAlpha();
        BufferedImage target = new BufferedImage(width, height,
                hasAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = target.createGraphics();
        try {
            graphics.setComposite(AlphaComposite.Src);
            graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                    RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            graphics.drawImage(source, 0, 0, width, height, null);
        } finally {
            graphics.dispose();
        }
        return target;
    }

    private static byte[] encodeJpeg(BufferedImage source) throws IOException {
        BufferedImage rgb = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D graphics = rgb.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(0, 0, rgb.getWidth(), rgb.getHeight());
            graphics.drawImage(source, 0, 0, null);
        } finally {
            graphics.dispose();
        }

        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            rgb.flush();
            throw new IOException("JPEG writer is unavailable");
        }
        ImageWriter writer = writers.next();
        try (ByteArrayOutputStream output = new ByteArrayOutputStream();
             ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
            writer.setOutput(imageOutput);
            ImageWriteParam params = writer.getDefaultWriteParam();
            params.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            params.setCompressionQuality(JPEG_QUALITY);
            writer.write(null, new IIOImage(rgb, null, null), params);
            imageOutput.flush();
            return output.toByteArray();
        } finally {
            writer.dispose();
            rgb.flush();
        }
    }

    private static byte[] encodePng(BufferedImage source) throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (!ImageIO.write(source, "png", output)) {
                throw new IOException("PNG writer is unavailable");
            }
            return output.toByteArray();
        }
    }

    private static String mimeTypeFor(String formatName) {
        return switch (formatName.toLowerCase(Locale.ROOT)) {
            case "jpeg", "jpg" -> "image/jpeg";
            case "png" -> "image/png";
            case "gif" -> "image/gif";
            case "bmp", "wbmp" -> "image/bmp";
            case "webp" -> "image/webp";
            default -> "image/" + formatName.toLowerCase(Locale.ROOT);
        };
    }

    private static boolean canReuseWithoutTranscoding(String formatName) {
        return "jpeg".equalsIgnoreCase(formatName)
                || "jpg".equalsIgnoreCase(formatName)
                || "png".equalsIgnoreCase(formatName);
    }

    private static void flushDistinct(BufferedImage... images) {
        for (int i = 0; i < images.length; i++) {
            BufferedImage image = images[i];
            if (image == null) continue;
            boolean alreadyFlushed = false;
            for (int j = 0; j < i; j++) {
                if (images[j] == image) {
                    alreadyFlushed = true;
                    break;
                }
            }
            if (!alreadyFlushed) image.flush();
        }
    }

    public record Result(byte[] bytes, String mimeType, int originalSize, int originalWidth, int originalHeight,
                         int outputWidth, int outputHeight, boolean optimized, String failureReason) {
        static Result success(byte[] bytes, String mimeType, int originalSize, int originalWidth, int originalHeight,
                              int outputWidth, int outputHeight, boolean optimized) {
            return new Result(bytes, mimeType, originalSize, originalWidth, originalHeight,
                    outputWidth, outputHeight, optimized, null);
        }

        static Result failure(int originalSize, String reason) {
            return failure(originalSize, "unknown", 0, 0, reason);
        }

        static Result failure(int originalSize, String format, int originalWidth, int originalHeight, String reason) {
            return new Result(null, format, originalSize, originalWidth, originalHeight,
                    0, 0, false, reason);
        }

        public boolean successful() {
            return bytes != null;
        }
    }
}
