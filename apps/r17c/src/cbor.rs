use heapless::Vec;

pub struct CborParser<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> CborParser<'a> {
    pub fn new(data: &'a [u8]) -> Self {
        Self { data, pos: 0 }
    }

    pub fn read_u8(&mut self) -> Option<u8> {
        let b = *self.data.get(self.pos)?;
        self.pos += 1;
        Some(b)
    }

    pub fn peek_u8(&self) -> Option<u8> {
        self.data.get(self.pos).copied()
    }

    pub fn read_len(&mut self, initial: u8) -> Option<usize> {
        let info = initial & 0x1F;
        match info {
            0..=23 => Some(info as usize),
            24 => {
                let b = self.read_u8()? as usize;
                Some(b)
            }
            25 => {
                let hi = self.read_u8()? as usize;
                let lo = self.read_u8()? as usize;
                Some((hi << 8) | lo)
            }
            26 => {
                if self.pos + 4 > self.data.len() {
                    return None;
                }
                let val = u32::from_be_bytes([
                    self.data[self.pos],
                    self.data[self.pos + 1],
                    self.data[self.pos + 2],
                    self.data[self.pos + 3],
                ]) as usize;
                self.pos += 4;
                Some(val)
            }
            27 => {
                if self.pos + 8 > self.data.len() {
                    return None;
                }
                let val = u64::from_be_bytes([
                    self.data[self.pos],
                    self.data[self.pos + 1],
                    self.data[self.pos + 2],
                    self.data[self.pos + 3],
                    self.data[self.pos + 4],
                    self.data[self.pos + 5],
                    self.data[self.pos + 6],
                    self.data[self.pos + 7],
                ]) as usize;
                self.pos += 8;
                Some(val)
            }
            _ => None,
        }
    }

    pub fn read_bytes(&mut self) -> Option<&'a [u8]> {
        let b = self.read_u8()?;
        if (b >> 5) != 2 {
            return None;
        }
        let len = self.read_len(b)?;
        let slice = self.data.get(self.pos..self.pos + len)?;
        self.pos += len;
        Some(slice)
    }

    pub fn read_text(&mut self) -> Option<&'a str> {
        let b = self.read_u8()?;
        if (b >> 5) != 3 {
            return None;
        }
        let len = self.read_len(b)?;
        let slice = self.data.get(self.pos..self.pos + len)?;
        self.pos += len;
        core::str::from_utf8(slice).ok()
    }

    pub fn read_int(&mut self) -> Option<i32> {
        let b = self.read_u8()?;
        let major = b >> 5;
        match major {
            0 => {
                let v = self.read_len(b)?;
                Some(v as i32)
            }
            1 => {
                let v = self.read_len(b)?;
                Some(-1 - v as i32)
            }
            _ => None,
        }
    }

    pub fn read_map_len(&mut self) -> Option<usize> {
        let b = self.read_u8()?;
        if (b >> 5) != 5 {
            return None;
        }
        self.read_len(b)
    }

    pub fn read_array_len(&mut self) -> Option<usize> {
        let b = self.read_u8()?;
        if (b >> 5) != 4 {
            return None;
        }
        self.read_len(b)
    }

    pub fn skip_value(&mut self) -> bool {
        let b = match self.read_u8() {
            Some(v) => v,
            None => return false,
        };
        let major = b >> 5;
        let ai = b & 0x1F;
        match major {
            0 | 1 => {
                match ai {
                    0..=23 => {}
                    24 => {
                        self.read_u8();
                    }
                    25 => {
                        for _ in 0..2 {
                            self.read_u8();
                        }
                    }
                    26 => {
                        for _ in 0..4 {
                            self.read_u8();
                        }
                    }
                    27 => {
                        for _ in 0..8 {
                            self.read_u8();
                        }
                    }
                    _ => return false,
                }
                true
            }
            2 | 3 => {
                if let Some(len) = self.read_len(b) {
                    if self.pos + len <= self.data.len() {
                        self.pos += len;
                        return true;
                    }
                }
                false
            }
            4 => {
                if let Some(count) = self.read_len(b) {
                    for _ in 0..count {
                        if !self.skip_value() {
                            return false;
                        }
                    }
                    true
                } else {
                    false
                }
            }
            5 => {
                if let Some(count) = self.read_len(b) {
                    for _ in 0..count * 2 {
                        if !self.skip_value() {
                            return false;
                        }
                    }
                    true
                } else {
                    false
                }
            }
            6 => {
                match ai {
                    0..=23 => {}
                    24 => {
                        self.read_u8();
                    }
                    25 => {
                        for _ in 0..2 {
                            self.read_u8();
                        }
                    }
                    26 => {
                        for _ in 0..4 {
                            self.read_u8();
                        }
                    }
                    27 => {
                        for _ in 0..8 {
                            self.read_u8();
                        }
                    }
                    _ => return false,
                }
                self.skip_value()
            }
            7 => match ai {
                0..=23 => true,
                24 => {
                    self.read_u8();
                    true
                }
                25 => {
                    for _ in 0..2 {
                        self.read_u8();
                    }
                    true
                }
                26 => {
                    for _ in 0..4 {
                        self.read_u8();
                    }
                    true
                }
                27 => {
                    for _ in 0..8 {
                        self.read_u8();
                    }
                    true
                }
                _ => false,
            },
            _ => false,
        }
    }
}

pub struct CborWriter {
    buf: Vec<u8, 512>,
}

impl Default for CborWriter {
    fn default() -> Self {
        Self { buf: Vec::new() }
    }
}

impl CborWriter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, b: u8) {
        self.buf.push(b).ok();
    }

    pub fn map(&mut self, count: usize) {
        if count <= 23 {
            self.push(0xA0 | count as u8);
        } else if count <= 0xFF {
            self.push(0xB8);
            self.push(count as u8);
        } else {
            self.push(0xB9);
            self.push((count >> 8) as u8);
            self.push((count & 0xFF) as u8);
        }
    }

    pub fn array(&mut self, count: usize) {
        if count <= 23 {
            self.push(0x80 | count as u8);
        } else {
            self.push(0x98);
            self.push(count as u8);
        }
    }

    pub fn unsigned(&mut self, val: u64) {
        if val <= 23 {
            self.push(val as u8);
        } else if val <= 0xFF {
            self.push(0x18);
            self.push(val as u8);
        } else if val <= 0xFFFF {
            self.push(0x19);
            self.push((val >> 8) as u8);
            self.push((val & 0xFF) as u8);
        } else {
            self.push(0x1A);
            self.push((val >> 24) as u8);
            self.push((val >> 16) as u8);
            self.push((val >> 8) as u8);
            self.push((val & 0xFF) as u8);
        }
    }

    pub fn negative(&mut self, val: i64) {
        let n = (-1 - val) as u64;
        if n <= 23 {
            self.push(0x20 | n as u8);
        } else if n <= 0xFF {
            self.push(0x38);
            self.push(n as u8);
        } else {
            self.push(0x39);
            self.push((n >> 8) as u8);
            self.push((n & 0xFF) as u8);
        }
    }

    pub fn bytes(&mut self, data: &[u8]) {
        let len = data.len();
        if len <= 23 {
            self.push(0x40 | len as u8);
        } else if len <= 0xFF {
            self.push(0x58);
            self.push(len as u8);
        } else {
            self.push(0x59);
            self.push((len >> 8) as u8);
            self.push((len & 0xFF) as u8);
        }
        self.buf.extend_from_slice(data).ok();
    }

    pub fn text(&mut self, s: &str) {
        let len = s.len();
        if len <= 23 {
            self.push(0x60 | len as u8);
        } else if len <= 0xFF {
            self.push(0x78);
            self.push(len as u8);
        } else {
            self.push(0x79);
            self.push((len >> 8) as u8);
            self.push((len & 0xFF) as u8);
        }
        self.buf.extend_from_slice(s.as_bytes()).ok();
    }

    pub fn bool_val(&mut self, v: bool) {
        self.push(if v { 0xF5 } else { 0xF4 });
    }

    pub fn raw(&mut self, data: &[u8]) {
        self.buf.extend_from_slice(data).ok();
    }

    pub fn into_vec(self) -> Vec<u8, 512> {
        self.buf
    }
}
