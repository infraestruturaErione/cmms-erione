package com.grash.security;

import com.grash.model.User;
import com.grash.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    @Lazy
    private UserService userService;

    @Override
    @Transactional(readOnly = true)
    public CustomUserDetail loadUserByUsername(String username) throws UsernameNotFoundException {
        // Contrato do UserDetailsService: usuario inexistente => UsernameNotFoundException (o
        // DaoAuthenticationProvider a converte em BadCredentialsException e ainda mitiga o ataque de
        // tempo). Antes, Optional.get() lancava NoSuchElementException - uma excecao fora do contrato
        // que so' virava "credencial invalida" por acidente, quando algum chamador a embrulhava.
        User user = userService.findByEmailWithRolesCached(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return CustomUserDetail.builder()//
                .user(user)//
                .build();
    }

}
