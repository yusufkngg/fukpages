let csrfToken = "";
const uploadIds = new WeakMap<File, string>();
export function setCsrf(value: string) {
  csrfToken = value;
}
export function uploadFiles(
  path: string,
  files: File[],
  fields: Record<string, string>,
  progress: (n: number) => void,
): Promise<{
  results: {
    ok: boolean;
    asset?: import("./studio").Asset;
    name?: string;
    error?: string;
  }[];
}> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api${path}`);
    xhr.timeout = 60_000;
    xhr.ontimeout = () =>
      reject(new Error("Yükleme zaman aşımına uğradı. Tekrar dene."));
    xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error("Bağlantı kesildi. Tekrar dene."));
    xhr.onload = () => {
      try {
        const result = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(result);
        else reject(new Error(result.error || "Yükleme başarısız."));
      } catch {
        reject(new Error("Yükleme yanıtı okunamadı."));
      }
    };
    const data = new FormData();
    data.append(
      "uploadIds",
      JSON.stringify(
        files.map((file) => {
          if (!uploadIds.has(file)) uploadIds.set(file, crypto.randomUUID());
          return uploadIds.get(file);
        }),
      ),
    );
    files.forEach((f) => data.append("files", f));
    Object.entries(fields).forEach(([k, v]) => data.append(k, v));
    xhr.send(data);
  });
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Sunucuya ulaşılamadı. Bağlantını kontrol edip tekrar dene.",
      0,
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      "Sunucunun yanıtı okunamadı. İşlemi tekrar dene.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(result.error ?? "İşlem tamamlanamadı.", response.status);
  return result;
}
export const json = (body: unknown) => JSON.stringify(body);
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
