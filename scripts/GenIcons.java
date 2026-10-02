// Renders LiquidPay launcher icons and splash screens for the Android project.
// Run: java scripts/GenIcons.java   (needs only a JDK; no image tools)
import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.geom.*;
import java.awt.image.BufferedImage;
import java.io.File;

public class GenIcons {
    static final Color LIME = new Color(0xE4F78A);
    static final Color NAVY = new Color(0x13212F);
    static final Color SAGE = new Color(0x93A6A7);
    static final String RES = "android/app/src/main/res/";

    /** Draws the rounded-asterisk mark centred at (cx, cy) with bar length len. */
    static void mark(Graphics2D g, double cx, double cy, double len) {
        double w = len * 11 / 42.0;
        g.setColor(NAVY);
        for (int r : new int[] { 0, 60, 120 }) {
            AffineTransform old = g.getTransform();
            g.rotate(Math.toRadians(r), cx, cy);
            g.fill(new RoundRectangle2D.Double(cx - w / 2, cy - len / 2, w, len, w, w));
            g.setTransform(old);
        }
        double d = len * 9 / 42.0;
        g.setColor(LIME);
        g.fill(new Ellipse2D.Double(cx - d / 2, cy - d / 2, d, d));
    }

    static Graphics2D gfx(BufferedImage img) {
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        return g;
    }

    static void write(BufferedImage img, String path) throws Exception {
        File f = new File(RES + path);
        f.getParentFile().mkdirs();
        ImageIO.write(img, "png", f);
    }

    public static void main(String[] a) throws Exception {
        String[] dens = { "mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi" };
        double[] scale = { 1, 1.5, 2, 3, 4 };
        for (int i = 0; i < dens.length; i++) {
            int s = (int) (48 * scale[i]);
            // Legacy square icon (pre-Android 8)
            BufferedImage sq = new BufferedImage(s, s, BufferedImage.TYPE_INT_ARGB);
            Graphics2D g = gfx(sq);
            g.setColor(LIME);
            g.fill(new RoundRectangle2D.Double(0, 0, s, s, s * 0.56, s * 0.56));
            mark(g, s / 2.0, s / 2.0, s * 0.62);
            g.dispose();
            write(sq, "mipmap-" + dens[i] + "/ic_launcher.png");
            // Legacy round icon
            BufferedImage rd = new BufferedImage(s, s, BufferedImage.TYPE_INT_ARGB);
            g = gfx(rd);
            g.setColor(LIME);
            g.fill(new Ellipse2D.Double(0, 0, s, s));
            mark(g, s / 2.0, s / 2.0, s * 0.58);
            g.dispose();
            write(rd, "mipmap-" + dens[i] + "/ic_launcher_round.png");
            // Adaptive foreground (108dp canvas, art inside the 66dp safe zone)
            int f = (int) (108 * scale[i]);
            BufferedImage fg = new BufferedImage(f, f, BufferedImage.TYPE_INT_ARGB);
            g = gfx(fg);
            mark(g, f / 2.0, f / 2.0, f * 0.40);
            g.dispose();
            write(fg, "mipmap-" + dens[i] + "/ic_launcher_foreground.png");
        }
        // Splash screens: keep each existing size, repaint sage + centred tile.
        for (String orient : new String[] { "land", "port" }) {
            for (String d : dens) {
                File f = new File(RES + "drawable-" + orient + "-" + d + "/splash.png");
                if (!f.exists()) continue;
                BufferedImage old = ImageIO.read(f);
                int w = old.getWidth(), h = old.getHeight();
                BufferedImage sp = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
                Graphics2D g = gfx(sp);
                g.setColor(SAGE);
                g.fillRect(0, 0, w, h);
                double t = Math.min(w, h) * 0.28;
                g.setColor(LIME);
                g.fill(new RoundRectangle2D.Double(w / 2.0 - t / 2, h / 2.0 - t / 2, t, t, t * 0.56, t * 0.56));
                mark(g, w / 2.0, h / 2.0, t * 0.62);
                g.dispose();
                ImageIO.write(sp, "png", f);
            }
        }
        File base = new File(RES + "drawable/splash.png");
        if (base.exists()) {
            BufferedImage old = ImageIO.read(base);
            BufferedImage sp = new BufferedImage(old.getWidth(), old.getHeight(), BufferedImage.TYPE_INT_RGB);
            Graphics2D g = gfx(sp);
            g.setColor(SAGE);
            g.fillRect(0, 0, sp.getWidth(), sp.getHeight());
            double t = Math.min(sp.getWidth(), sp.getHeight()) * 0.28;
            g.setColor(LIME);
            g.fill(new RoundRectangle2D.Double(sp.getWidth() / 2.0 - t / 2, sp.getHeight() / 2.0 - t / 2, t, t, t * 0.56, t * 0.56));
            mark(g, sp.getWidth() / 2.0, sp.getHeight() / 2.0, t * 0.62);
            g.dispose();
            ImageIO.write(sp, "png", base);
        }
        System.out.println("icons + splash written");
    }
}
