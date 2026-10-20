// build.rs: lo exige todo proyecto Tauri (genera el contexto de la app en tiempo de compilacion).
fn main() {
    tauri_build::build()
}
